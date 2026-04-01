import React, { useState, useEffect, useRef ,useMemo } from 'react';

// ✨ 新增 initialPath 作為 Props
const AutoPathMap = ({ onPathUpdate, mode, station, initialPath }) => {
  const [points, setPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef(null);

  // 🔄 修正：當 initialPath 改變（例如點擊編輯）時，同步更新畫布
  useEffect(() => {
    if (initialPath && Array.isArray(initialPath)) {
      setPoints(initialPath);
    } else {
      setPoints([]);
    }
  }, [initialPath, station]); // 當切換工作站或傳入新路徑時觸發

  const getCoordinates = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: Math.round(((clientX - rect.left) / rect.width) * 100),
      y: Math.round(((clientY - rect.top) / rect.height) * 100)
    };
  };

  const handleStart = (e) => {
    if (mode === 'shot') {
      const coord = getCoordinates(e);
      addPoint(coord.x, coord.y, 'shot');
      return;
    }
    setIsDrawing(true);
    const coord = getCoordinates(e);
    addPoint(coord.x, coord.y, 'path');
  };

  const handleMove = (e) => {
    if (!isDrawing || mode !== 'path') return;
    if (e.cancelable) e.preventDefault();

    const coord = getCoordinates(e);
    const lastPoint = points[points.length - 1];

    // 🚀 關鍵優化：增加抽稀距離
    // 將原本的 2 提高到 4 或 5，可以大幅減少點的數量，且不影響視覺路徑
    const minDistance = 5;

    if (!lastPoint || Math.hypot(coord.x - lastPoint.x, coord.y - lastPoint.y) > minDistance) {
      addPoint(coord.x, coord.y, 'path');
    }
  };

  const handleEnd = () => setIsDrawing(false);

  const addPoint = (x, y, type) => {
    // 使用函數式更新，確保獲取最新的點陣列
    setPoints(prev => {
      const newPoints = [...prev, { x, y, type }];
      onPathUpdate(newPoints);
      return newPoints;
    });
  };

  // ...其餘 Function (removePoint, undoLastPoint) 保持不變
  const removePoint = (e, index) => {
    e.stopPropagation();
    const newPoints = points.filter((_, i) => i !== index);
    setPoints(newPoints);
    onPathUpdate(newPoints);
  };

  const undoLastPoint = () => {
    const newPoints = points.slice(0, -1);
    setPoints(newPoints);
    onPathUpdate(newPoints);
  };

  const isRed = station.includes('Red');
  const arrowHeadPoints = useMemo(() => {
    const pathPoints = points.filter(p => p.type === 'path');
    if (pathPoints.length < 2) return ""; // 至少要兩個點才能決定方向

    const p2 = pathPoints[pathPoints.length - 1]; // 最後一個點 (終點)
    const p1 = pathPoints[pathPoints.length - 2]; // 倒數第二個點

    // 計算角度 (考慮 Aspect Ratio 2:1，這裡 Y 軸需要修正一下比例以達到視覺角度正確)
    // 但因為我們用的是百分比座標，Aspect Ratio 是 2:1，所以 Y 的差異需要除以 2 
    const angle = Math.atan2((p2.y - p1.y), (p2.x - p1.x));
    const headlen = 5; // 箭頭長度

    // 計算箭頭的兩個頂點 (在 100x100 的 SVG 空間中)
    const x1 = p2.x - headlen * Math.cos(angle - Math.PI / 6);
    const y1 = p2.y - headlen * Math.sin(angle - Math.PI / 6);
    const x2 = p2.x - headlen * Math.cos(angle + Math.PI / 6);
    const y2 = p2.y - headlen * Math.sin(angle + Math.PI / 6);

    // 回傳 SVG polyline 或 polygon 格式的 points 字串
    return `${p2.x},${p2.y} ${x1},${y1} ${x2},${y2}`;
  }, [points]); // 只有當 points 改變時重新計算

  return (
    <div style={styles.wrapper}>
      <div style={styles.hint}>
        <span style={{ color: isRed ? '#f44336' : '#2196F3' }}>
          ● {station} {mode === 'path' ? '(畫筆模式)' : '(點擊射球)'}
        </span>
        <span style={styles.scrollHint}>路徑用劃的，射球用點的</span>
      </div>

      <div style={styles.scrollContainer}>
        <div
          ref={containerRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{
            ...styles.mapBase,
            backgroundImage: 'url("/field-full.png")',
            border: `3px solid ${isRed ? '#f44336' : '#2196F3'}`,
            touchAction: 'none' // ✨ 重要：禁用 iPad 預設手勢
          }}
        >
         {/* SVG 渲染層 ✨ */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svgLayer}>
            {/* 繪製連續路徑線 (使用二次曲線美化) ✨ */}
            <path
              d={points.filter(p => p.type === 'path').reduce((pathString, point, index, array) => {
                if (index === 0) {
                  return `M ${point.x},${point.y}`;
                } else if (index === array.length - 1) {
                  // 最後一個點用 lineTo，確保連線
                  return `${pathString} L ${point.x},${point.y}`;
                } else {
                  // 使用二次曲線 (Quadratic Curve) 連接
                  const xc = (point.x + array[index + 1].x) / 2;
                  const yc = (point.y + array[index + 1].y) / 2;
                  return `${pathString} Q ${point.x},${point.y}, ${xc},${yc}`;
                }
              }, "")}
              fill="none"
              stroke="#ffeb3b"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            
            {/* ✨ 繪製方向箭頭 (實心三角形) ✨ */}
            {arrowHeadPoints && (
              <polygon
                points={arrowHeadPoints}
                fill="#ffeb3b" // 與線條顏色一致
                stroke="white"
                strokeWidth="0.1" // 增加一點白框讓箭頭更清晰
              />
            )}
          </svg>
          {points.map((p, i) => {
            // ✨ 如果是路徑點，只顯示起點（白色圓點）和射球點
            if (p.type === 'path' && i !== 0) return null; 

            const isStart = p.type === 'path' && i === 0;

            return (
              <div 
                key={i} 
                onClick={(e) => removePoint(e, i)}
                style={{
                  ...styles.point,
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: isStart ? '#fff' : p.type === 'shot' ? '#4caf50' : 'rgba(244, 67, 54, 0.5)',
                  width: p.type === 'shot' || isStart ? '14px' : '6px',
                  height: p.type === 'shot' || isStart ? '14px' : '6px',
                  border: isStart ? '2px solid #ffeb3b' : '1px solid white' // 起點增加黃框識別
                }} 
              />
            );
          })}
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button onClick={undoLastPoint} style={styles.undoBtn}>復原 (Undo)</button>
        <button onClick={() => { if (window.confirm("清空？")) { setPoints([]); onPathUpdate([]); } }} style={styles.resetBtn}>
          全部清空
        </button>
      </div>
    </div>
  );
};

const styles = {
  wrapper: { width: '100%', marginBottom: '10px' },
  hint: { fontSize: '14px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' },
  scrollHint: { color: '#666', fontSize: '11px' },
  scrollContainer: { width: '100%', overflowX: 'hidden', borderRadius: '8px', backgroundColor: '#ddd' },
  mapBase: { width: '100%', aspectRatio: '2/1', backgroundSize: '100% 100%', position: 'relative', cursor: 'crosshair' },
  svgLayer: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 },
  point: { position: 'absolute', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '1px solid white', zIndex: 5 },
  buttonRow: { display: 'flex', gap: '10px', marginTop: '10px' },
  undoBtn: { flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: '#e3f2fd', color: '#1976d2', fontWeight: 'bold', border: 'none' },
  resetBtn: { padding: '12px', borderRadius: '8px', backgroundColor: '#fff', color: '#666', border: '1px solid #ccc' }
};

export default AutoPathMap;