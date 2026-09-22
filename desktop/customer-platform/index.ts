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
export { CustomerHome } from "./CustomerHome";
export { CustomerNavSection, customerNavContainsAdmin } from "./CustomerNavSection";
export { CustomerMobileNavDrawer } from "./CustomerMobileNavDrawer";
export { isCustomerSurface, isCustomerServiceWorkspace } from "./surface";
export {
  ServiceWorkspace,
  CreateVideoServiceWorkspace,
  EditPhotoServiceWorkspace,
  PassportPhotoServiceWorkspace,
  DesignStudioServiceWorkspace,
  AudioServiceWorkspace,
  VIDEO_SERVICE_STEPS,
  IMAGE_SERVICE_STEPS,
} from "./workspace";
export {
  CustomerPage,
  ResponsiveContainer,
  SectionHeader,
  ServiceCard,
  ServiceCategory,
  ServiceGrid,
  CategoryCard,
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
