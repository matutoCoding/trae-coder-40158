export default defineAppConfig({
  pages: [
    'pages/queue/index',
    'pages/priority/index',
    'pages/quota/index',
    'pages/records/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0fc6c2',
    navigationBarTitleText: '体检套餐分流',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#86909c',
    selectedColor: '#0fc6c2',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/queue/index',
        text: '排队叫号'
      },
      {
        pagePath: 'pages/priority/index',
        text: '优先级'
      },
      {
        pagePath: 'pages/quota/index',
        text: '额度管理'
      },
      {
        pagePath: 'pages/records/index',
        text: '消费明细'
      }
    ]
  }
})
