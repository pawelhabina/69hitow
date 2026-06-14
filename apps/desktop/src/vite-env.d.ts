/// <reference types="vite/client" />

interface Window {
  beatGrid?: {
    openAdminPanel: () => Promise<boolean>;
    openExternalUrl: (url: string) => Promise<boolean>;
  };
}
