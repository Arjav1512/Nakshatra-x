import { getSyncQueue, removeFromSyncQueue } from './db';

// This is a mock API call for demonstration purposes
const syncMutationToServer = async (action: string, payload: any) => {
  console.log(`Syncing action: ${action}`, payload);
  // In a real app, you would make a fetch request to your backend
  // return fetch('/api/sync', { method: 'POST', body: JSON.stringify({action, payload}) })
  return new Promise(resolve => setTimeout(resolve, 500)); 
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) {
    console.log('Currently offline, sync paused.');
    return;
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    console.log('Sync queue is empty.');
    return;
  }

  console.log(`Processing sync queue. ${queue.length} items to sync.`);

  for (const item of queue) {
    try {
      await syncMutationToServer(item.action, item.payload);
      // If successful, remove from queue
      await removeFromSyncQueue(item.id);
      console.log(`Successfully synced item: ${item.id}`);
    } catch (error) {
      console.error(`Failed to sync item ${item.id}. Will retry later.`, error);
      // Stop processing the queue on first failure to maintain order, 
      // or implement more complex retry logic
      break; 
    }
  }

  console.log('Finished processing sync queue.');
};

// Listen for online event to trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online! Triggering sync...');
    processSyncQueue();
  });
}
