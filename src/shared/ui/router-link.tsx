import {
  Button as AstryxButton,
  type ButtonProps as AstryxButtonProps,
} from '@astryxdesign/core/Button'
import {
  Link as AstryxLink,
  type LinkProps as AstryxLinkProps,
} from '@astryxdesign/core/Link'
import { createLink } from '@tanstack/react-router'

// eslint-disable-next-line react-refresh/only-export-components
function AstryxRouterLinkBase(props: AstryxLinkProps) {
  return <AstryxLink {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
function AstryxRouterButtonLinkBase(props: AstryxButtonProps) {
  return <AstryxButton {...props} />
}

// createLink returns components while preserving TanStack Router's route types.
export const RouterLink = createLink(AstryxRouterLinkBase)
export const RouterButtonLink = createLink(AstryxRouterButtonLinkBase)
