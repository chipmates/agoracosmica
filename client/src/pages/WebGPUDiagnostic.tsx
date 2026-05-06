// client/src/pages/WebGPUDiagnostic.tsx
// Simple diagnostic to check WebGPU availability

import React, { useState, useEffect } from 'react';

export const WebGPUDiagnostic: React.FC = () => {
  const [gpuInfo, setGpuInfo] = useState<any>(null);

  useEffect(() => {
    const checkGPU = async () => {
      const info: any = {
        // Basic checks
        gpuInNavigator: 'gpu' in navigator,
        navigatorKeys: Object.keys(navigator).filter(k => k.toLowerCase().includes('gpu')),

        // Try to access navigator.gpu
        navigatorGpu: (navigator as any).gpu,
        navigatorGpuType: typeof (navigator as any).gpu,

        // Browser info
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,

        // Capabilities
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,

        // Check if WebGPU API is accessible
        canAccessGpu: false,
        gpuError: null
      };

      // Try to actually request adapter
      if ((navigator as any).gpu) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          info.canAccessGpu = !!adapter;

          if (adapter) {
            info.adapterInfo = {
              vendor: adapter.vendor || 'Unknown',
              architecture: adapter.architecture || 'Unknown',
              device: adapter.device || 'Unknown',
              features: Array.from(adapter.features || [])
            };
          }
        } catch (error: any) {
          info.gpuError = error.message;
        }
      }

      setGpuInfo(info);
      console.log('🔍 [WebGPU Diagnostic] Complete info:', info);
    };

    checkGPU();
  }, []);

  if (!gpuInfo) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Checking WebGPU...</div>;
  }

  return (
    <div style={{
      padding: '40px 20px',
      maxWidth: '1000px',
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: 'var(--gold-base)' }}>🔍 WebGPU Diagnostic</h1>

      <div style={{
        padding: '24px',
        background: gpuInfo.gpuInNavigator ? 'rgba(46, 213, 115, 0.1)' : 'rgba(233, 116, 81, 0.1)',
        border: `3px solid ${gpuInfo.gpuInNavigator ? 'var(--success-green)' : 'var(--coral-base)'}`,
        borderRadius: '12px',
        marginBottom: '32px'
      }}>
        <h2 style={{
          marginTop: 0,
          fontSize: '32px',
          color: gpuInfo.gpuInNavigator ? 'var(--success-green)' : 'var(--coral-base)'
        }}>
          {gpuInfo.gpuInNavigator ? '✅ WebGPU Available' : '❌ WebGPU NOT Available'}
        </h2>
        <div style={{ fontSize: '16px', marginTop: '12px' }}>
          <code>'gpu' in navigator</code> = <strong>{String(gpuInfo.gpuInNavigator)}</strong>
        </div>
      </div>

      <h2>Detailed Checks</h2>

      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Basic Detection */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0 }}>Basic Detection</h3>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>navigator.gpu exists</td>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>
                  {gpuInfo.navigatorGpuType !== 'undefined' ? '✅ Yes' : '❌ No'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>navigator.gpu type</td>
                <td style={{ padding: '8px', fontFamily: 'monospace' }}>{gpuInfo.navigatorGpuType}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>Can request adapter</td>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>
                  {gpuInfo.canAccessGpu ? '✅ Yes' : '❌ No'}
                </td>
              </tr>
              {gpuInfo.gpuError && (
                <tr>
                  <td style={{ padding: '8px', opacity: 0.7 }}>Error</td>
                  <td style={{ padding: '8px', color: 'var(--coral-base)' }}>{gpuInfo.gpuError}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Browser Info */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0 }}>Browser Info</h3>
          <table style={{ width: '100%', fontSize: '14px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>Vendor</td>
                <td style={{ padding: '8px' }}>{gpuInfo.vendor}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>Platform</td>
                <td style={{ padding: '8px' }}>{gpuInfo.platform}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>CPU Cores</td>
                <td style={{ padding: '8px' }}>{gpuInfo.hardwareConcurrency}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', opacity: 0.7 }}>Device Memory</td>
                <td style={{ padding: '8px' }}>{gpuInfo.deviceMemory ? `${gpuInfo.deviceMemory}GB` : 'Unknown'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* GPU Adapter Info */}
        {gpuInfo.adapterInfo && (
          <div style={{
            padding: '16px',
            background: 'rgba(46, 213, 115, 0.1)',
            border: '2px solid var(--success-green)',
            borderRadius: '8px'
          }}>
            <h3 style={{ marginTop: 0 }}>✅ GPU Adapter Info</h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', opacity: 0.7 }}>Vendor</td>
                  <td style={{ padding: '8px' }}>{gpuInfo.adapterInfo.vendor}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', opacity: 0.7 }}>Architecture</td>
                  <td style={{ padding: '8px' }}>{gpuInfo.adapterInfo.architecture}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', opacity: 0.7 }}>Features</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {gpuInfo.adapterInfo.features.join(', ') || 'None'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* User Agent */}
        <details style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '12px' }}>
            View User Agent String
          </summary>
          <code style={{
            display: 'block',
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '6px',
            wordBreak: 'break-all',
            fontSize: '12px',
            lineHeight: '1.6'
          }}>
            {gpuInfo.userAgent}
          </code>
        </details>

        {/* Navigator keys with 'gpu' */}
        {gpuInfo.navigatorKeys.length > 0 && (
          <div style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            <h3 style={{ marginTop: 0 }}>Navigator Keys Containing "gpu"</h3>
            <code style={{ fontSize: '14px' }}>
              {gpuInfo.navigatorKeys.join(', ') || 'None found'}
            </code>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: 'rgba(212, 165, 57, 0.1)',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginTop: 0 }}>💡 Recommendations</h3>
        {!gpuInfo.gpuInNavigator && (
          <>
            <p><strong>WebGPU is not available in your browser.</strong></p>
            <p>Possible reasons:</p>
            <ul>
              <li>Chrome flags disabled - Check <code>chrome://flags/#enable-unsafe-webgpu</code></li>
              <li>Old Chrome version - WebGPU requires Chrome 113+ (you have {navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'})</li>
              <li>macOS too old - WebGPU requires macOS 11+ (Big Sur) minimum</li>
              <li>GPU not supported - Some older GPUs don't support WebGPU</li>
            </ul>
          </>
        )}
        {gpuInfo.gpuInNavigator && !gpuInfo.canAccessGpu && (
          <>
            <p><strong>navigator.gpu exists but adapter request failed.</strong></p>
            <p>Error: {gpuInfo.gpuError}</p>
          </>
        )}
        {gpuInfo.canAccessGpu && (
          <p style={{ color: 'var(--success-green)' }}>
            <strong>✅ WebGPU fully functional!</strong> You can use the fastest Kokoro configuration.
          </p>
        )}
      </div>
    </div>
  );
};
