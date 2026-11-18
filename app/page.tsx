
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "32px", fontWeight: 700 }}>
        Next.js Website
      </h1>

      <p style={{ marginTop: "12px", color: "#666" }}>
        Your website is getting ready!
      </p>

      <div
        style={{
          marginTop: "24px",
          padding: "12px 24px",
          background: "#184f35",
          color: "#ffffff",
          borderRadius: "8px",
        }}
      >
        Deployment Ready
      </div>
    </main>
  );
}
