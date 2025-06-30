const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

async function build() {
  try {
    // Read the source file
    const sourceCode = fs.readFileSync(
      path.join(__dirname, 'src', 'widget.js'), 
      'utf8'
    );

    // Minify the code
    const result = await minify(sourceCode, {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        pure_funcs: ['console.log']
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false
      }
    });

    // Create build directory if it doesn't exist
    const buildDir = path.join(__dirname, 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // Write minified file
    fs.writeFileSync(
      path.join(buildDir, 'widget.min.js'),
      result.code
    );

    // Also create a non-minified version for development
    fs.copyFileSync(
      path.join(__dirname, 'src', 'widget.js'),
      path.join(buildDir, 'widget.js')
    );

    console.log('✅ Build successful!');
    console.log(`📦 Output: ${path.join(buildDir, 'widget.min.js')}`);
    
    // Show file sizes
    const sourceSize = Buffer.byteLength(sourceCode, 'utf8');
    const minifiedSize = Buffer.byteLength(result.code, 'utf8');
    const reduction = ((1 - minifiedSize / sourceSize) * 100).toFixed(2);
    
    console.log(`📊 Original: ${(sourceSize / 1024).toFixed(2)} KB`);
    console.log(`📊 Minified: ${(minifiedSize / 1024).toFixed(2)} KB`);
    console.log(`📊 Reduction: ${reduction}%`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();