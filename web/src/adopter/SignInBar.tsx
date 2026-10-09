// Sign in / out with Amazon Cognito. Hidden when sign-in isn't configured.

import { useState } from "react";
import { signedIn, signIn, signInAvailable, signOut } from "../api/auth";

export function SignInBar() {
  const [inNow, setInNow] = useState(signedIn());
  if (!signInAvailable) return null;
  return (
    <div className="signin">
      {inNow ? (
        <>
          <span className="muted small">Signed in</span>
          <button onClick={() => { signOut(); setInNow(false); }}>Sign out</button>
        </>
      ) : (
        <>
          <span className="muted small">Sign in to adopt and send proofs</span>
          <button className="primary" onClick={() => signIn()}>Sign in</button>
        </>
      )}
    </div>
  );
}
