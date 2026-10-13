import {initApp} from './ui.js';
import {initAuth} from './auth.js';
let app;
const auth=initAuth(window,{onSessionChanged:()=>app?.handleAccountChange()});
try{await auth.ready();}catch{/* Keep the device profile available if the account service is unreachable. */}
app=initApp(window,{auth});
