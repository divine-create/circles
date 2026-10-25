import React from 'react';
import {
  Award,
  BarChart2,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  Compass,
  CreditCard,
  FolderKanban,
  GraduationCap,
  Heart,
  Home,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  Megaphone,
  MessageSquare,
  Newspaper,
  Repeat,
  Shield,
  ShoppingBag,
  UserCheck,
  Users,
} from 'lucide-react';

export function DynamicIcon({
  name,
  className = 'w-4 h-4',
}: {
  name?: string | null;
  className?: string;
}) {
  switch (name) {
    case 'message-square':
      return <MessageSquare className={className} />;
    case 'megaphone':
      return <Megaphone className={className} />;
    case 'layout-grid':
      return <LayoutGrid className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'book-open':
      return <BookOpen className={className} />;
    case 'bar-chart-2':
      return <BarChart2 className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'life-buoy':
      return <LifeBuoy className={className} />;
    case 'calendar':
      return <Calendar className={className} />;
    case 'check-circle':
      return <CheckCircle className={className} />;
    case 'user-check':
      return <UserCheck className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'map-pin':
      return <MapPin className={className} />;
    case 'briefcase':
      return <Briefcase className={className} />;
    case 'repeat':
      return <Repeat className={className} />;
    case 'home':
      return <Home className={className} />;
    case 'graduation-cap':
      return <GraduationCap className={className} />;
    case 'folder-kanban':
      return <FolderKanban className={className} />;
    case 'newspaper':
      return <Newspaper className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'credit-card':
      return <CreditCard className={className} />;
    default:
      return <Compass className={className} />;
  }
}
