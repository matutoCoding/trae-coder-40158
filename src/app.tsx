import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import './app.scss';
import { useQueueStore } from '@/store/useQueueStore';

function App(props) {
  const initStore = useQueueStore(state => state.initStore);
  const checkAndResetPeriod = useQueueStore(state => state.checkAndResetPeriod);

  useEffect(() => {
    initStore();
    console.log('[App] 应用启动');
  }, [initStore]);

  useDidShow(() => {
    checkAndResetPeriod();
    console.log('[App] 页面显示，检查周期');
  });

  useDidHide(() => {});

  return props.children;
}

export default App;
