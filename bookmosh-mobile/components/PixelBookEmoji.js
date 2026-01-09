import React from 'react'
import { SvgXml } from 'react-native-svg'

const PIXEL_BOOK_SVG = (color) => `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="4" width="12" height="16" fill="${color}"/>
  <rect x="7" y="5" width="10" height="14" fill="#0b1220"/>
  <rect x="8" y="6" width="8" height="1" fill="${color}"/>
  <rect x="8" y="8" width="6" height="1" fill="${color}"/>
  <rect x="8" y="10" width="7" height="1" fill="${color}"/>
  <rect x="8" y="12" width="5" height="1" fill="${color}"/>
  <rect x="5" y="4" width="1" height="16" fill="${color}"/>
  <rect x="18" y="4" width="1" height="16" fill="${color}"/>
  <rect x="6" y="20" width="12" height="1" fill="${color}"/>
</svg>`

export default function PixelBookEmoji({ size = 16, color = '#ee6bfe' }) {
  return <SvgXml xml={PIXEL_BOOK_SVG(color)} width={size} height={size} />
}
