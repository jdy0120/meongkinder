import React from "react";
import ReactQueryProvider from "@/shared/providers/ReactQueryProvider";
import { Toaster, TooltipProvider } from "@template/ui";

interface LayoutProps {
  children: React.ReactNode;
}

const layout = ({ children }: LayoutProps) => {
  return (
    <TooltipProvider>
      <ReactQueryProvider>
        <main
          id='app-container'
          className='unselectable relative flex w-full flex-col h-full overflow-x-hidden'
        >
          <div className='flex-1 w-full overflow-y-auto'>{children}</div>
        </main>
        <Toaster />
      </ReactQueryProvider>
    </TooltipProvider>
  );
};

export default layout;
