const input = [];

process.stdin.on('data', (data) => {
  input.push(data);
});

process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(input).toString());
  
  const filePath = data.tool_input?.file_path || '';
  
  if (filePath.includes('.env')) {
    console.error('Access denied: Cannot read .env files');
    process.exit(2);
  }
  
  process.exit(0);
});