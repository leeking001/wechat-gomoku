App({
  onLaunch() {
    // 初始化应用
    console.log('五子棋小程序启动');

    // 检查微信版本
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(() => {
          wx.showModal({
            title: '更新提示',
            content: '新版本已准备好，是否重启应用？',
            success: (res) => {
              if (res.confirm) {
                updateManager.applyUpdate();
              }
            }
          });
        });
      }
    });
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  globalData: {
    userInfo: null
  }
});