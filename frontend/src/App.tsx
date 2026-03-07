import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { TopNav } from "@/components/layout/TopNav";
import { ProjectList } from "@/pages/ProjectList";
import { Workspace } from "@/pages/Workspace";

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col overflow-hidden">
        <TopNav />
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<Workspace />} />
        </Routes>
      </div>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
