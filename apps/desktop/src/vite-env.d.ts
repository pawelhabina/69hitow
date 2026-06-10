/// <reference types="vite/client" />

interface Window {
  beatGrid?: {
    openAdminPanel: () => Promise<boolean>;
  };
}
