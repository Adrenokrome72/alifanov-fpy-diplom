// frontend/src/components/ProgressBar.js
import React from 'react';

export default function ProgressBar({value}) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{height:8, background:'#eef2ff', borderRadius:8, overflow:'hidden'}}>
      <div style={{width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#06b6d4)'}} />
    </div>
  );
}
