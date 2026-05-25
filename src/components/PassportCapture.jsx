"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, RotateCcw, CheckCircle2, AlertCircle, X, ZoomIn } from "lucide-react";
import styles from "./Passportcapture.module.css";

/**
 * PassportCapture — drop-in passport selfie component.
 *
 * Props:
 *   value       : File | null  — current captured image file
 *   onChange    : (file: File | null) => void
 *   error       : string       — external validation error to show
 *
 * Usage in register page:
 *   <PassportCapture value={passport} onChange={setPassport} error={errors.passport} />
 */
export default function PassportCapture({ value, onChange, error }) {
  const [mode, setMode] = useState("idle"); // idle | camera | preview | error
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState("");
  const [faceHint, setFaceHint] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enlarged, setEnlarged] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const checkRef = useRef(null);

  // Open camera
  async function openCamera() {
    setCamError("");
    setFaceHint("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(s);
      setMode("camera");
    } catch (err) {
      setCamError("Camera access denied. Please allow camera permission and try again.");
      setMode("error");
    }
  }

  // Attach stream to video element once camera mode is active
  useEffect(() => {
    if (mode === "camera" && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [mode, stream]);

  // Stop stream helper
  function stopStream() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  // Retake — go back to camera
  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onChange(null);
    setFaceHint("");
    openCamera();
  }

  // Cancel entirely
  function cancel() {
    stopStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onChange(null);
    setMode("idle");
    setFaceHint("");
    setCamError("");
  }

  // Capture photo
  async function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");

    // Mirror the canvas to match the mirrored preview
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.restore();

    // Basic brightness check
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brightness = getAverageBrightness(imageData);

    if (brightness < 40) {
      setFaceHint("Too dark — move to a brighter area.");
      setCapturing(false);
      return;
    }
    if (brightness > 220) {
      setFaceHint("Too bright — reduce direct light.");
      setCapturing(false);
      return;
    }

    // Check face region (center oval) has skin-like tones
    const faceRegion = ctx.getImageData(
      canvas.width * 0.3, canvas.height * 0.1,
      canvas.width * 0.4, canvas.height * 0.7
    );
    const hasFace = checkSkinTones(faceRegion);

    if (!hasFace) {
      setFaceHint("No face detected — centre your face in the oval.");
      setCapturing(false);
      return;
    }

    setFaceHint("");

    canvas.toBlob((blob) => {
      const file = new File([blob], "passport.jpg", { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      onChange(file);
      stopStream();
      setMode("preview");
      setCapturing(false);
    }, "image/jpeg", 0.92);
  }

  function getAverageBrightness(imageData) {
    let sum = 0;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    }
    return sum / (data.length / 4);
  }

  function checkSkinTones(imageData) {
    const data = imageData.data;
    let skinPixels = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Broad skin tone range covering all ethnicities
      if (
        r > 60 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 10 &&
        r - b > 15 &&
        r < 250
      ) skinPixels++;
    }
    return skinPixels / total > 0.08; // at least 8% skin pixels
  }

  // ── IDLE STATE ──────────────────────────────────────────────────────────
  if (mode === "idle" && !value) {
    return (
      <div className={styles.wrap}>
        <button
          type="button"
          onClick={openCamera}
          className={`${styles.triggerBtn} ${error ? styles.triggerError : ""}`}
        >
          <div className={styles.triggerIcon}>
            <Camera size={22} color="#15803d" strokeWidth={1.8} />
          </div>
          <div className={styles.triggerText}>
            <span className={styles.triggerTitle}>Take Passport Photo</span>
            <span className={styles.triggerHint}>Front-facing · Clear face · Good lighting</span>
          </div>
          <div className={styles.triggerBadge}>PHOTO</div>
        </button>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    );
  }

  // ── ERROR STATE ─────────────────────────────────────────────────────────
  if (mode === "error") {
    return (
      <div className={styles.wrap}>
        <div className={styles.camErrorBox}>
          <AlertCircle size={18} color="#dc2626" strokeWidth={2} />
          <span>{camError}</span>
          <button type="button" onClick={() => setMode("idle")} className={styles.retryBtn}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── PREVIEW STATE ───────────────────────────────────────────────────────
  if (mode === "preview" && previewUrl) {
    return (
      <div className={styles.wrap}>
        <div className={styles.previewWrap}>
          {/* Passport-style portrait preview */}
          <div className={styles.previewCard}>
            <div className={styles.previewImgWrap} onClick={() => setEnlarged(true)}>
              <img src={previewUrl} alt="Passport photo" className={styles.previewImg} />
              <div className={styles.previewZoom}>
                <ZoomIn size={13} color="#fff" strokeWidth={2} />
              </div>
            </div>
            <div className={styles.previewMeta}>
              <span className={styles.previewLabel}>Passport Photo</span>
              <span className={styles.previewSub}>Tap to enlarge</span>
            </div>
          </div>

          {/* Status pill */}
          <div className={styles.previewStatus}>
            <CheckCircle2 size={20} color="#15803d" strokeWidth={2} />
            <span> Photo captured successfully </span>
          </div>

          {/* Retake */}
          <button type="button" onClick={retake} className={styles.retakeBtn}>
            <RotateCcw size={13} strokeWidth={2} />
            Retake Photo
          </button>
        </div>

        {/* Lightbox */}
        {enlarged && (
          <div className={styles.lightbox} onClick={() => setEnlarged(false)}>
            <button className={styles.lightboxClose} onClick={() => setEnlarged(false)}>
              <X size={20} color="#fff" />
            </button>
            <img src={previewUrl} alt="Passport preview enlarged" className={styles.lightboxImg} />
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    );
  }

  // ── CAMERA STATE ────────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div className={styles.cameraWrap}>

        {/* Live viewfinder */}
        <div className={styles.viewfinder}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
          />

          {/* Corner brackets */}
          <div className={`${styles.bracket} ${styles.bracketTL}`} />
          <div className={`${styles.bracket} ${styles.bracketTR}`} />
          <div className={`${styles.bracket} ${styles.bracketBL}`} />
          <div className={`${styles.bracket} ${styles.bracketBR}`} />

          {/* Face oval guide */}
          <div className={styles.ovalGuide} />

          {/* Hint overlay */}
          {faceHint && (
            <div className={styles.hintOverlay}>
              <AlertCircle size={14} color="#fbbf24" strokeWidth={2} />
              <span>{faceHint}</span>
            </div>
          )}

          {/* Instruction strip */}
          <div className={styles.instructionStrip}>
            Centre your face · Look straight · Stay still
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button type="button" onClick={cancel} className={styles.cancelBtn}>
            Cancel
          </button>

          <button
            type="button"
            onClick={capture}
            disabled={capturing}
            className={styles.shutterBtn}
            aria-label="Take photo"
          >
            <div className={styles.shutterInner} />
          </button>

          {/* spacer to balance layout */}
          <div style={{ width: 72 }} />
        </div>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}