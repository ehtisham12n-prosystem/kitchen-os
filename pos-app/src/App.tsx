import { useEffect } from 'react';
import { PosTerminal } from './PosTerminal';
import { SyncService } from './services/sync.service';
import './App.css';

function App() {
  useEffect(() => {
    // Initial Catalog Pull
    SyncService.syncCatalogDown();

    // Start Background Daemon
    SyncService.startBackgroundDaemon();
  }, []);

  return <PosTerminal />;
}

export default App;
