import * as Tooltip from "@radix-ui/react-tooltip";
import { EditorLayout } from "@/editor";

function App() {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <EditorLayout />
    </Tooltip.Provider>
  );
}

export default App;
