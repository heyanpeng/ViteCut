import { Tooltip } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { EditorLayout } from "@/editor";

function App() {
  return (
    <Theme appearance="dark" radius="medium">
      <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
        <EditorLayout />
      </Tooltip.Provider>
    </Theme>
  );
}

export default App;
