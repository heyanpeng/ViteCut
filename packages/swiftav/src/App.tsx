import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useExampleStore } from "./stores";

function App() {
  const [count, setCount] = useState(0);
  
  // Zustand store 使用示例
  const { count: zustandCount, name, increment, decrement, reset, setName, incrementAsync } = useExampleStore();

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      
      {/* Zustand Store 示例 */}
      <div className="card" style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Zustand Store 示例</h2>
        <p>计数: {zustandCount}</p>
        <p>名称: {name}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={increment}>增加</button>
          <button onClick={decrement}>减少</button>
          <button onClick={reset}>重置</button>
          <button onClick={incrementAsync}>异步增加</button>
        </div>
        <div style={{ marginTop: '10px' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入名称"
            style={{ padding: '5px', marginRight: '10px' }}
          />
        </div>
      </div>
      
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
