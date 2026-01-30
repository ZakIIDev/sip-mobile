/**
 * Icon Component
 *
 * Unified icon component using Phosphor icons.
 * Provides consistent sizing, coloring, and access to all app icons.
 *
 * Usage:
 *   <Icon category="privacy" name="shielded" size="md" color="brand" />
 *   <Icon category="status" name="success" size="lg" color="success" />
 *   <Icon category="biometric" name="fingerprint" weight="fill" />
 */

import React from "react"
import { ICONS, ICON_SIZES, ICON_COLORS } from "@/constants/icons"
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps } from "phosphor-react-native"

// ============================================================================
// TYPES
// ============================================================================

type IconCategory = keyof typeof ICONS

export interface IconProps {
  /** Icon category (e.g., "privacy", "status", "wallet") */
  category: IconCategory
  /** Icon name within the category */
  name: string
  /** Size preset or number */
  size?: keyof typeof ICON_SIZES | number
  /** Color preset or hex string */
  color?: keyof typeof ICON_COLORS | string
  /** Phosphor weight variant */
  weight?: PhosphorIconProps["weight"]
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Icon({
  category,
  name,
  size = "md",
  color = "white",
  weight = "regular",
}: IconProps) {
  // Get the icon component from the category
  const categoryIcons = ICONS[category]
  if (!categoryIcons) {
    if (__DEV__) {
      console.warn(`[Icon] Category not found: ${category}`)
    }
    return null
  }

  const IconComponent = categoryIcons[name as keyof typeof categoryIcons] as PhosphorIcon | undefined
  if (!IconComponent) {
    if (__DEV__) {
      console.warn(`[Icon] Icon not found: ${category}.${name}`)
    }
    return null
  }

  // Resolve size
  const iconSize = typeof size === "number" ? size : ICON_SIZES[size]

  // Resolve color
  const iconColor =
    color in ICON_COLORS ? ICON_COLORS[color as keyof typeof ICON_COLORS] : color

  return <IconComponent size={iconSize} color={iconColor} weight={weight} />
}

// ============================================================================
// DIRECT ICON HELPERS
// ============================================================================

/**
 * Get an icon component directly for inline use
 * @example const ShieldIcon = getIcon("privacy", "shielded")
 */
export function getIcon<T extends IconCategory>(category: T, name: keyof (typeof ICONS)[T]): PhosphorIcon {
  return ICONS[category][name] as PhosphorIcon
}

/**
 * Render props helper for custom icon rendering
 */
export function renderIcon(
  category: IconCategory,
  name: string,
  props?: Partial<Omit<IconProps, "category" | "name">>
) {
  return <Icon category={category} name={name} {...props} />
}
