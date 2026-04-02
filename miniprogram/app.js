App({
  onLaunch() {
    // 初始化应用
    console.log('App launched');
  },

  onShow() {
    console.log('App showed');
  },

  onHide() {
    console.log('App hidden');
  },

  globalData: {
    userInfo: null,
  }
});
