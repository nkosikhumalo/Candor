import { useCallback } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import CookieConsent from "./components/CookieConsent";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Quote from "./pages/Quote";
import PreMemberWelcome from "./pages/PreMemberWelcome";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const backgroundLocation = location.state?.backgroundLocation;
  const showChatPopup = location.pathname === "/chat" && Boolean(backgroundLocation);

  const closeChat = useCallback(() => {
    navigate(backgroundLocation || "/home", { replace: true });
  }, [backgroundLocation, navigate]);

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/welcome" element={<PreMemberWelcome />} />
        <Route path="/home" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/quote" element={<Quote />} />
      </Routes>
      {showChatPopup && <Chat popup onClose={closeChat} />}
      <CookieConsent />
    </>
  );
}

export default App;
