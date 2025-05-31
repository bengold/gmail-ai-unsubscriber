const tailwind = require('tailwindcss');
const fs = require('fs');
const path = require('path');

async function buildCSS() {
  try {
    console.log('🎨 Building Tailwind CSS...');
    
    // For now, copy the source CSS as the build output since we're using Tailwind CDN
    // In production, you would use the Tailwind CLI or PostCSS build process
    const inputPath = path.join(__dirname, 'public/styles.css');
    const outputPath = path.join(__dirname, 'public/dist/styles.css');
    
    // Create dist directory if it doesn't exist
    const distDir = path.dirname(outputPath);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Copy source to dist (in production, this would be processed)
    const inputCSS = fs.readFileSync(inputPath, 'utf8');
    fs.writeFileSync(outputPath, inputCSS);
    
    console.log('✅ Tailwind CSS built successfully!');
    console.log('📦 Output:', outputPath);
    console.log('💡 Note: Currently using Tailwind CDN for development.');
    console.log('💡 For production, set up the Tailwind CLI build process.');
    
  } catch (error) {
    console.error('❌ Error building CSS:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  console.log('👀 Watching for CSS changes...');
  const chokidar = require('chokidar');
  
  chokidar.watch('public/styles.css').on('change', () => {
    console.log('🔄 CSS changed, rebuilding...');
    buildCSS();
  });
  
  // Initial build
  buildCSS();
} else {
  buildCSS();
}
