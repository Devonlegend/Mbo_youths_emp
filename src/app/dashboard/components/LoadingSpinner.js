export default function LoadingSpinner({ fullPage = false }) {
  if (fullPage) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        width: "100%",
      }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 20px",
      width: "100%",
    }}>
      <Spinner />
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: "2.5px solid #e2e8f0",
        borderTopColor: "#15803d",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}