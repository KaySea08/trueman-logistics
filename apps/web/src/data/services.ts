import { Plane, Ship, Truck, Warehouse, PackageCheck, Globe2 } from 'lucide-react';

export const services = [
  {
    title: 'Air Freight',
    description: 'Time-conscious international cargo shipping from China by air.',
    icon: Plane,
    detail: 'Air cargo options for eligible destinations and shipment types.',
  },
  {
    title: 'Sea Freight',
    description: 'Ocean freight options for larger, heavier and less time-sensitive cargo.',
    icon: Ship,
    detail: 'Container and consolidated ocean freight, subject to route availability.',
  },
  {
    title: 'Express Shipping',
    description: 'Parcel and document delivery options for urgent international shipments.',
    icon: Truck,
    detail: 'Express options depend on destination, parcel profile and carrier coverage.',
  },
  {
    title: 'Cargo Consolidation',
    description: 'Combine eligible shipments into a coordinated international consignment.',
    icon: PackageCheck,
    detail: 'Consolidation support for suitable cargo and destination routes.',
  },
  {
    title: 'Warehousing',
    description: 'Cargo receiving, temporary storage and shipment preparation in China.',
    icon: Warehouse,
    detail: 'Warehouse handling availability must be confirmed for the origin location.',
  },
  {
    title: 'International Logistics',
    description: 'Coordinated shipping support from China to international destinations.',
    icon: Globe2,
    detail: 'Route planning and service coordination for cross-border shipments.',
  },
];
