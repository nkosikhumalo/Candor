import { useEffect, useRef, useState } from "react";
import "../styles/face-capture.css";

export default function FaceCapture({ onCaptureChange, label = "Take a selfie" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => setError("The camera preview could not start. Try opening the camera again."));
  }, [cameraOpen]);

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Open this page over HTTPS on a device with a camera.");
      return;
    }

    setOpening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError("Candor could not open the front camera. Allow camera access in your browser settings and try again.");
      stopCamera();
    } finally {
      setOpening(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Wait for the camera preview, then take your photo.");
      return;
    }
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedPhoto = canvas.toDataURL("image/jpeg", 0.82);
    setPhoto(capturedPhoto);
    onCaptureChange?.(true);
    setError("");
    stopCamera();
  }

  function retakePhoto() {
    setPhoto("");
    onCaptureChange?.(false);
    void openCamera();
  }

  return (
    <section className="face-capture" aria-label={label}>
      <div className="face-capture-copy">
        <strong>{label} <span>Required</span></strong>
        <p>Take a clear photo of yourself with the front camera before continuing.</p>
      </div>

      {photo ? (
        <div className="face-capture-preview-wrap">
          <img className="face-capture-preview" src={photo} alt="Your captured selfie preview" />
          <div className="face-capture-complete" role="status">Photo captured</div>
          <button type="button" className="hp-btn-ghost" onClick={retakePhoto}>Retake photo</button>
        </div>
      ) : (
        <div className="face-capture-controls">
          {cameraOpen ? (
            <>
              <video ref={videoRef} className="face-capture-video" autoPlay playsInline muted aria-label="Front camera preview" />
              <button type="button" className="hp-btn-primary" onClick={capturePhoto}>Take photo</button>
            </>
          ) : (
            <button type="button" className="hp-btn-ghost" onClick={openCamera} disabled={opening}>
              {opening ? "Opening camera…" : "Open front camera"}
            </button>
          )}
        </div>
      )}

      {error && <p className="face-capture-error" role="alert">{error}</p>}
      <p className="face-capture-note">Presentation capture only: this photo stays in this browser, is not uploaded, and does not verify or recognize your identity.</p>
    </section>
  );
}
