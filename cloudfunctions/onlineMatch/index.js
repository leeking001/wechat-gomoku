const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MATCH_COLLECTION = 'online_matches';
const RECORD_COLLECTION = 'online_records';
const USER_COLLECTION = 'online_users';

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(message) {
  return { ok: false, message };
}

function normalizeName(name, fallback) {
  const text = String(name || '').trim();
  return text ? text.slice(0, 10) : fallback;
}

function getOpenId() {
  return cloud.getWXContext().OPENID;
}

async function saveUserProfile(playerId, openId, playerName) {
  const nickName = normalizeName(playerName, '玩家');
  const now = Date.now();
  const payload = {
    playerId,
    openId,
    nickName,
    updatedAt: now
  };
  const exists = await db.collection(USER_COLLECTION)
    .where({ playerId })
    .limit(1)
    .get();

  if (exists.data && exists.data.length > 0) {
    await db.collection(USER_COLLECTION).doc(exists.data[0]._id).update({
      data: payload
    });
    return;
  }

  await db.collection(USER_COLLECTION).add({
    data: {
      ...payload,
      createdAt: now
    }
  });
}

async function trySaveUserProfile(playerId, openId, playerName) {
  try {
    await saveUserProfile(playerId, openId, playerName);
  } catch (err) {
    console.warn('[onlineMatch] save user profile failed', err);
  }
}

async function createRoom(event) {
  const openId = getOpenId();
  const playerId = event.playerId || openId;
  const playerName = normalizeName(event.playerName, '玩家');
  const snapshot = event.snapshot;
  if (!snapshot) return fail('missing snapshot');

  await trySaveUserProfile(playerId, openId, playerName);

  const res = await db.collection(MATCH_COLLECTION).add({
    data: {
      status: 'waiting',
      hostId: playerId,
      hostOpenId: openId,
      hostName: playerName,
      guestId: '',
      guestOpenId: '',
      guestName: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      snapshot,
      actions: []
    }
  });

  return ok({ roomId: res._id });
}

async function getRoom(roomId) {
  const res = await db.collection(MATCH_COLLECTION).doc(roomId).get();
  return res.data;
}

async function joinRoom(event) {
  const openId = getOpenId();
  const roomId = event.roomId;
  const playerId = event.playerId || openId;
  const playerName = normalizeName(event.playerName, '好友');
  if (!roomId) return fail('missing roomId');

  await trySaveUserProfile(playerId, openId, playerName);

  const room = await getRoom(roomId);
  if (!room) return fail('room not found');

  if (!room.guestId && room.hostId !== playerId) {
    await db.collection(MATCH_COLLECTION).doc(roomId).update({
      data: {
        guestId: playerId,
        guestOpenId: openId,
        guestName: playerName,
        status: 'playing',
        updatedAt: Date.now()
      }
    });
    room.guestId = playerId;
    room.guestOpenId = openId;
    room.guestName = playerName;
    room.status = 'playing';
  } else if (room.hostId === playerId && !room.hostName) {
    await db.collection(MATCH_COLLECTION).doc(roomId).update({
      data: {
        hostName: normalizeName(event.playerName, '玩家'),
        updatedAt: Date.now()
      }
    });
    room.hostName = normalizeName(event.playerName, '玩家');
  } else if (room.guestId === playerId && !room.guestName) {
    await db.collection(MATCH_COLLECTION).doc(roomId).update({
      data: {
        guestName: playerName,
        updatedAt: Date.now()
      }
    });
    room.guestName = playerName;
  }

  return ok({ room });
}

async function saveUser(event) {
  const openId = getOpenId();
  const playerId = event.playerId || openId;
  const playerName = normalizeName(event.playerName, '玩家');
  await saveUserProfile(playerId, openId, playerName);
  return ok();
}

function canAccess(room, playerId, openId) {
  return room.hostId === playerId ||
    room.guestId === playerId ||
    room.hostOpenId === openId ||
    room.guestOpenId === openId;
}

async function getRoomState(event) {
  const openId = getOpenId();
  const roomId = event.roomId;
  const playerId = event.playerId || openId;
  if (!roomId) return fail('missing roomId');

  const room = await getRoom(roomId);
  if (!room) return fail('room not found');
  if (!canAccess(room, playerId, openId)) return fail('permission denied');

  return ok({ room });
}

async function updateRoom(event) {
  const openId = getOpenId();
  const roomId = event.roomId;
  const playerId = event.playerId || openId;
  const payload = event.payload;
  if (!roomId || !payload || !payload.snapshot) return fail('invalid payload');

  const room = await getRoom(roomId);
  if (!room) return fail('room not found');
  if (!canAccess(room, playerId, openId)) return fail('permission denied');

  const nextVersion = Math.max((room.version || 1) + 1, payload.version || 1);
  const actions = Array.isArray(room.actions) ? room.actions.slice(-80) : [];
  if (payload.lastAction) {
    actions.push({
      ...payload.lastAction,
      at: Date.now(),
      by: playerId
    });
  }

  await db.collection(MATCH_COLLECTION).doc(roomId).update({
    data: {
      version: nextVersion,
      snapshot: payload.snapshot,
      actions,
      status: payload.status || room.status || 'playing',
      updatedAt: Date.now(),
      winner: payload.snapshot.winner || null
    }
  });

  return ok({ version: nextVersion });
}

async function saveRecord(event) {
  const openId = getOpenId();
  const roomId = event.roomId;
  const playerId = event.playerId || openId;
  const record = event.record;
  if (!roomId || !record) return fail('invalid record');

  const room = await getRoom(roomId);
  if (!room) return fail('room not found');
  if (!canAccess(room, playerId, openId)) return fail('permission denied');

  const exists = await db.collection(RECORD_COLLECTION)
    .where({ roomId })
    .limit(1)
    .get();
  if (exists.data && exists.data.length > 0) {
    return ok({ duplicated: true });
  }

  await db.collection(RECORD_COLLECTION).add({
    data: {
      ...record,
      roomId,
      hostId: room.hostId,
      guestId: room.guestId,
      hostName: room.hostName || '玩家',
      guestName: room.guestName || '好友',
      createdAt: Date.now()
    }
  });

  return ok();
}

exports.main = async (event) => {
  try {
    if (event.action === 'create') return await createRoom(event);
    if (event.action === 'join') return await joinRoom(event);
    if (event.action === 'saveUser') return await saveUser(event);
    if (event.action === 'get') return await getRoomState(event);
    if (event.action === 'update') return await updateRoom(event);
    if (event.action === 'saveRecord') return await saveRecord(event);
    return fail('unknown action');
  } catch (err) {
    console.error('[onlineMatch]', err);
    return fail(err.message || 'server error');
  }
};
