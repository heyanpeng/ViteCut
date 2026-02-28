import { Tooltip } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { ToasterProvider } from "@/components/Toaster";
import { EditorLayout } from "@/editor";

function App() {
  return (
    <Theme appearance="dark" radius="medium">
      <ToasterProvider>
        <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
          <EditorLayout />
        </Tooltip.Provider>
      </ToasterProvider>
    </Theme>
  );
}

export default App;
