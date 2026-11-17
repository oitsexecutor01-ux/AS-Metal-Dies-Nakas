import React from 'react';
import CustomerApp from './components/CustomerApp.jsx';
import StaffApp from './components/StaffApp.jsx';
import ClickSpark from './components/ClickSpark.jsx';
import InstallPWA from './components/InstallPWA.jsx';
import { commerceReady, useCommerceStore } from './lib/store.js';

export default function App() {
  const [ready,setReady] = React.useState(false);
  const [error,setError] = React.useState('');
  const data = useCommerceStore();
  React.useEffect(()=>{commerceReady.then(()=>setReady(true)).catch(()=>setError('Could not connect to the commerce backend. Start the backend and verify MONGODB_URI in backend/.env.'));},[]);
  if (error) return <main className="container page-body small-page"><div className="panel"><h1>Backend unavailable</h1><p>{error}</p></div></main>;
  if (!ready) return <main className="container page-body small-page"><p>Connecting to the commerce database…</p></main>;
  // Hosting BOTH on one origin keeps the demo's browser data shared.
  const isStaff = /^\/staff(?:\/|$)/i.test(window.location.pathname);
  return <ClickSpark sparkColor={['#b9622d','#eebf99']} shape="line" sparkCount={7} sparkSize={12} sparkRadius={26} duration={450} style={{minHeight:'100vh'}}>
    {isStaff ? <StaffApp data={data} /> : <CustomerApp data={data} />}
    <InstallPWA />
  </ClickSpark>;
}
