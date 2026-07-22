import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          background: '#111827',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              width: 14,
              height: 56,
              background: '#dfe344',
              marginRight: 20,
            }}
          />
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>
            TSE Online
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 300, color: '#f3f4f6', maxWidth: 900 }}>
          Printer cartridges, done properly.
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#9ca3af', marginTop: 24 }}>
          South Africa&apos;s printer-cartridge specialist since 1987
        </div>
      </div>
    ),
    { ...size },
  )
}
