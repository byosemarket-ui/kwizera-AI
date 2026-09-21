export type {
  CustomerCategory,
  CustomerCategoryKey,
  CustomerNavGroup,
  CustomerNavItem,
  CustomerService,
  CustomerServiceStatus,
} from "./types";
export { CustomerRegistryError } from "./validation";
export { CUSTOMER_CATEGORIES } from "./categories";
export { CUSTOMER_SERVICES } from "./services";
export { CustomerServiceRegistry, customerServiceRegistry } from "./registry";
export { resolveCustomerIcon } from "./icons";
export { CustomerCatalog } from "./CustomerCatalog";
export { CustomerNavSection, customerNavContainsAdmin } from "./CustomerNavSection";
export { CustomerMobileNavDrawer } from "./CustomerMobileNavDrawer";
export {
  CustomerPage,
  ResponsiveContainer,
  SectionHeader,
  ServiceCard,
  ServiceCategory,
  ServiceGrid,
  QuickAction,
  ProjectCard,
  EmptyState,
  LoadingState,
  ErrorState,
  StatusBadge,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  SearchInput,
} from "./components/ui";
