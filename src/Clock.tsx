import React, { useState, useEffect } from 'react';
import './Clock.css';

type FlipperProps = {
  currentTime: string;
  nextTime: string;
};

const Flipper: React.FC<FlipperProps> = ({ currentTime, nextTime }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  
  useEffect(() => {
    if (isFlipping) return;
    
    setIsFlipping(true);
    const timer = setTimeout(() => {
      setIsFlipping(false);
    }, 600);
    
    return () => clearTimeout(timer);
  }, [currentTime, nextTime, isFlipping]);
  
  return (
    <div className={`flip ${isFlipping ? 'running' : ''}`}>
      <div className="digital front" data-number={currentTime}></div>
      <div className="digital back" data-number={nextTime}></div>
    </div>
  );
};

const getTimeFromDate = (date: Date): string => {
  return date
    .toTimeString()
    .slice(0, 8)
    .split(":")
    .join("");
};

const getDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[date.getDay()];
  return `${year}年${month}月${day}日 星期${weekday}`;
};

const Clock: React.FC = () => {
  const [timeStr, setTimeStr] = useState(getTimeFromDate(new Date()));
  const [dateStr, setDateStr] = useState(getDateString(new Date()));
  
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(getTimeFromDate(now));
      setDateStr(getDateString(now));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // 将时间字符串分解为各个数字
  const timeDigits = timeStr.split('');
  
  return (
    <div className="clock-container">
      <div className="clock">
        <Flipper currentTime={timeDigits[0]} nextTime={timeDigits[0]} />
        <Flipper currentTime={timeDigits[1]} nextTime={timeDigits[1]} />
        <em className="divider">:</em>
        <Flipper currentTime={timeDigits[2]} nextTime={timeDigits[2]} />
        <Flipper currentTime={timeDigits[3]} nextTime={timeDigits[3]} />
        <em className="divider">:</em>
        <Flipper currentTime={timeDigits[4]} nextTime={timeDigits[4]} />
        <Flipper currentTime={timeDigits[5]} nextTime={timeDigits[5]} />
      </div>
      <div className="date-display">
        {dateStr}
      </div>
    </div>
  );
};

export default Clock;