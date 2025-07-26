import "./App.css";
import NeonChat from "./componnents/neonChat";
import SessionHistory from "./componnents/sessionHistory";
const App = () => {
  return (
    <div className="App">
      <NeonChat></NeonChat>
      <SessionHistory></SessionHistory>
    </div>
  );
};
export default App;
