// API route để kiểm tra server có đang chạy không
export async function GET() {
  return Response.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
}

