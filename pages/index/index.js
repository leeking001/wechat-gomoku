const size = 15
Page({
  data: { size, cell: 0, board: [], over: false, winner: 0, canvasWidth: 0, canvasHeight: 0, statusText: '你的回合(黑)', isThinking: false, depthOptions: [1,2,3], depth: 2, last: null, offsetLeft: 0, offsetTop: 0 },
  onLoad() {
    const w = wx.getSystemInfoSync().windowWidth
    const pad = 20
    const s = w - pad * 2
    const cell = Math.floor(s / size)
    const cw = cell * size
    const ch = cell * size
    const b = []
    for (let i = 0; i < size; i++) { b[i] = Array(size).fill(0) }
    this.setData({ cell, canvasWidth: cw, canvasHeight: ch, board: b })
    this.ctx = wx.createCanvasContext('board', this)
    this.drawAll()
    wx.createSelectorQuery().in(this).select('#board').boundingClientRect(r=>{ if(r) { this.setData({ offsetLeft: r.left, offsetTop: r.top }) } }).exec()
  },
  drawAll() {
    const { cell, canvasWidth, canvasHeight, board, last } = this.data
    const ctx = this.ctx
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.setFillStyle('#dcb35c')
    ctx.fillRect(0,0,canvasWidth,canvasHeight)
    ctx.setStrokeStyle('#555')
    for (let i = 0; i < size; i++) {
      ctx.moveTo(cell/2 + i * cell, cell/2); ctx.lineTo(cell/2 + i * cell, cell/2 + (size-1) * cell)
      ctx.moveTo(cell/2, cell/2 + i * cell); ctx.lineTo(cell/2 + (size-1) * cell, cell/2 + i * cell)
    }
    ctx.stroke()
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = board[y][x]
        if (!v) continue
        const cx = x * cell + cell/2
        const cy = y * cell + cell/2
        ctx.beginPath()
        ctx.arc(cx, cy, cell * 0.45, 0, Math.PI * 2)
        if (v === 1) { ctx.setFillStyle('#000') } else { ctx.setFillStyle('#fff'); ctx.setStrokeStyle('#000') }
        ctx.fill()
        if (v === 2) { ctx.stroke() }
      }
    }
    if (last) {
      const cx = last.x * cell + cell/2
      const cy = last.y * cell + cell/2
      ctx.setStrokeStyle('red')
      ctx.setLineWidth(2)
      ctx.moveTo(cx-5, cy); ctx.lineTo(cx+5, cy)
      ctx.moveTo(cx, cy-5); ctx.lineTo(cx, cy+5)
      ctx.stroke()
    }
    ctx.draw()
  },
  touch(e) {
    if (this.data.over || this.data.isThinking) return
    const x = e.changedTouches[0].x - this.data.offsetLeft
    const y = e.changedTouches[0].y - this.data.offsetTop
    const cell = this.data.cell
    let gx = Math.round((x - cell/2) / cell)
    let gy = Math.round((y - cell/2) / cell)
    if (gx < 0 || gy < 0 || gx >= size || gy >= size) return
    const board = this.data.board
    if (board[gy][gx]) return
    board[gy][gx] = 1
    this.setData({ board, last: {x: gx, y: gy} })
    if (this.checkWin(gx, gy, 1)) {
      this.setData({ over: true, winner: 1, statusText: '你赢了' })
      this.drawAll(); return
    }
    if (this.isDraw()) { this.setData({ over: true, statusText: '平局' }); this.drawAll(); return }
    this.setData({ isThinking: true, statusText: 'AI 计算中...' })
    setTimeout(()=>{ this.aiTurn() }, 50)
    this.drawAll()
  },
  isDraw() {
    const b = this.data.board
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (b[y][x]===0) return false
    return true
  },
  checkWin(x, y, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    const board = this.data.board
    for (const [dx, dy] of dirs) {
      let c = 1
      for (let s = 1; s < 5; s++) {
        const nx = x + dx * s, ny = y + dy * s
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) break
        if (board[ny][nx] === player) c++; else break
      }
      for (let s = 1; s < 5; s++) {
        const nx = x - dx * s, ny = y - dy * s
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) break
        if (board[ny][nx] === player) c++; else break
      }
      if (c >= 5) return true
    }
    return false
  },
  getCandidates() {
    const b = this.data.board
    const set = {}
    const add = (x,y)=>{ if (x<0||y<0||x>=size||y>=size) return; if (b[y][x]!==0) return; const k = x+','+y; if (!set[k]) set[k] = {x,y} }
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (b[y][x]) {
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) { if (dx===0 && dy===0) continue; add(x+dx,y+dy) }
    }
    const arr = Object.values(set)
    if (arr.length===0) arr.push({x: Math.floor(size/2), y: Math.floor(size/2)})
    arr.sort((a,b)=>{
      const ca = Math.abs(a.x-size/2)+Math.abs(a.y-size/2)
      const cb = Math.abs(b.x-size/2)+Math.abs(b.y-size/2)
      return ca-cb
    })
    return arr
  },
  evalBoard() {
    const scoreFor = (player)=>{
      let s = 0
      const b = this.data.board
      const dirs = [[1,0],[0,1],[1,1],[1,-1]]
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (b[y][x]===player) {
        for (const [dx,dy] of dirs) {
          let cnt=1
          let open1=0, open2=0
          let nx=x+dx, ny=y+dy
          while(nx>=0&&ny>=0&&nx<size&&ny<size&&b[ny][nx]===player){cnt++; nx+=dx; ny+=dy}
          if(nx>=0&&ny>=0&&nx<size&&ny<size&&b[ny][nx]===0) open1=1
          nx=x-dx; ny=y-dy
          while(nx>=0&&ny>=0&&nx<size&&ny<size&&b[ny][nx]===player){cnt++; nx-=dx; ny-=dy}
          if(nx>=0&&ny>=0&&nx<size&&ny<size&&b[ny][nx]===0) open2=1
          const open = open1+open2
          if (cnt>=5) s+=10000000
          else if (cnt===4 && open>=1) s+=100000
          else if (cnt===3 && open===2) s+=10000
          else if (cnt===3 && open===1) s+=1000
          else if (cnt===2 && open===2) s+=500
        }
      }
      return s
    }
    return scoreFor(2) - scoreFor(1)
  },
  minimax(depth, alpha, beta, maximizing) {
    if (depth===0) return this.evalBoard()
    const moves = this.getCandidates()
    if (maximizing) {
      let best = -Infinity
      for (const m of moves) {
        const b = this.data.board
        b[m.y][m.x] = 2
        if (this.checkWin(m.x,m.y,2)) { best = Math.max(best, 10000000); b[m.y][m.x]=0; alpha=Math.max(alpha,best); if (beta<=alpha) break; continue }
        const val = this.minimax(depth-1, alpha, beta, false)
        b[m.y][m.x] = 0
        if (val>best) best=val
        if (best>alpha) alpha=best
        if (beta<=alpha) break
      }
      return best
    } else {
      let best = Infinity
      for (const m of moves) {
        const b = this.data.board
        b[m.y][m.x] = 1
        if (this.checkWin(m.x,m.y,1)) { best = Math.min(best, -10000000); b[m.y][m.x]=0; beta=Math.min(beta,best); if (beta<=alpha) break; continue }
        const val = this.minimax(depth-1, alpha, beta, true)
        b[m.y][m.x] = 0
        if (val<best) best=val
        if (best<beta) beta=best
        if (beta<=alpha) break
      }
      return best
    }
  },
  aiTurn() {
    const b = this.data.board
    let empty = true
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) if (b[y][x]) { empty=false; break }
    if (empty) {
      const cx = Math.floor(size/2), cy = Math.floor(size/2)
      b[cy][cx] = 2
      this.setData({ board: b, last: {x: cx, y: cy}, isThinking: false, statusText: '你的回合(黑)' })
      this.drawAll(); return
    }
    const moves = this.getCandidates()
    let best = moves[0]
    let bestScore = -Infinity
    const d = this.data.depth
    for (const m of moves) {
      b[m.y][m.x] = 2
      const val = this.minimax(d-1, -Infinity, Infinity, false)
      b[m.y][m.x] = 0
      if (val>bestScore) { bestScore=val; best=m }
    }
    b[best.y][best.x] = 2
    const won = this.checkWin(best.x,best.y,2)
    if (won) {
      this.setData({ board: b, last: {x: best.x, y: best.y}, isThinking: false, over: true, winner: 2, statusText: 'AI 赢了' })
    } else if (this.isDraw()) {
      this.setData({ board: b, last: {x: best.x, y: best.y}, isThinking: false, over: true, statusText: '平局' })
    } else {
      this.setData({ board: b, last: {x: best.x, y: best.y}, isThinking: false, statusText: '你的回合(黑)' })
    }
    this.drawAll()
  },
  onDepthChange(e) {
    const idx = parseInt(e.detail.value)
    const d = this.data.depthOptions[idx]
    this.setData({ depth: d })
  },
  restart() {
    const b = []
    for (let i = 0; i < size; i++) { b[i] = Array(size).fill(0) }
    this.setData({ board: b, over: false, winner: 0, statusText: '你的回合(黑)', isThinking: false, last: null })
    this.drawAll()
  }
})