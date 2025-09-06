export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>PodcastFlow Pro - Test Page</h1>
      <p>If you can see this, the application is running correctly!</p>
      <p>Server is accessible at port 3001</p>
      <hr />
      <h2>Next Steps:</h2>
      <ul>
        <li>Go to <a href="/login">/login</a> to test authentication</li>
        <li>Master credentials: Check AWS Secrets Manager or environment variables</li>
      </ul>
    </div>
  )
}