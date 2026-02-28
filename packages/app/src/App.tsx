import { Tooltip } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { ToasterProvider } from "@/components/Toaster";
import { AuthProvider, useAuth } from "@/contexts";
import { LoginModal } from "@/components/LoginModal";
import { EditorLayout } from "@/editor";

function AppContent() {
  const { token, isLoading } = useAuth();
  return (
    <>
      <EditorLayout />
      {!isLoading && !token && <LoginModal />}
    </>
  );
}

function App() {
  return (
    <Theme appearance="dark" radius="medium">
      <AuthProvider>
        <ToasterProvider>
          <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
            <AppContent />
          </Tooltip.Provider>
        </ToasterProvider>
        </AuthProvider>
    </Theme>
  );
}

export default App;
