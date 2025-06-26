// utils/delay.js
export function randomDelay(min = 6000, max = 10000) {
  return new Promise(res => setTimeout(res, min + Math.random() * (max - min)));
} 