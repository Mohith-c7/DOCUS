import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['tesseract.js', 'pdf-to-png-converter', 'pdfjs-dist'],
};

export default nextConfig;
