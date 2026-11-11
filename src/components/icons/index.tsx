// Iconos de Garra: un único punto para cambiar de set.
// Phosphor (MIT) en dos pesos: «duotone» (trazo crema + relleno naranja de
// marca, ver .app-icon-duo en globals.css) para navegación, cifras y objetos;
// «regular»/«bold» para acciones pequeñas en línea, donde el dúo hace ruido.
// Los nombres exportados son los de Lucide que usaba la app, para que el
// cambio no toque cada pantalla. Se importa desde el índice SSR de Phosphor
// (sin contexto de React, válido en componentes de servidor y cliente);
// el paquete es ESM con sideEffects:false, así que el bundle solo incluye
// los iconos usados.
import { forwardRef, type ComponentType } from "react"
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react"
import {
  ArrowCircleDown as PhArrowCircleDown,
  ArrowCircleUp as PhArrowCircleUp,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowDownRight as PhArrowDownRight,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowUpRight as PhArrowUpRight,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsInLineVertical as PhArrowsInLineVertical,
  ArrowsLeftRight as PhArrowsLeftRight,
  ArrowsOut as PhArrowsOut,
  Bank as PhBank,
  Bell as PhBell,
  Bug as PhBug,
  Buildings as PhBuildings,
  Calendar as PhCalendar,
  CalendarBlank as PhCalendarBlank,
  CalendarDots as PhCalendarDots,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  CaretUpDown as PhCaretUpDown,
  ChatCircleText as PhChatCircleText,
  ChartLine as PhChartLine,
  ChartLineUp as PhChartLineUp,
  Check as PhCheck,
  Palette as PhPalette,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  Cloud as PhCloud,
  CloudSlash as PhCloudSlash,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  DeviceMobile as PhDeviceMobile,
  DotsThree as PhDotsThree,
  DownloadSimple as PhDownloadSimple,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  FileArrowDown as PhFileArrowDown,
  Fire as PhFire,
  Flag as PhFlag,
  Funnel as PhFunnel,
  Gauge as PhGauge,
  HandCoins as PhHandCoins,
  HardDrive as PhHardDrive,
  House as PhHouse,
  CarProfile as PhCarProfile,
  Watch as PhWatch,
  Diamond as PhDiamond,
  PaintBrush as PhPaintBrush,
  Package as PhPackage,
  Scales as PhScales,
  Info as PhInfo,
  Key as PhKey,
  Lightbulb as PhLightbulb,
  LockSimple as PhLockSimple,
  Crown as PhCrown,
  List as PhList,
  MagnifyingGlass as PhMagnifyingGlass,
  MagnifyingGlassMinus as PhMagnifyingGlassMinus,
  Minus as PhMinus,
  Money as PhMoney,
  MoonStars as PhMoonStars,
  PaperPlaneTilt as PhPaperPlaneTilt,
  PencilLine as PhPencilLine,
  PencilSimple as PhPencilSimple,
  Percent as PhPercent,
  PiggyBank as PhPiggyBank,
  Plus as PhPlus,
  Pulse as PhPulse,
  Receipt as PhReceipt,
  Repeat as PhRepeat,
  ShieldCheck as PhShieldCheck,
  ShieldWarning as PhShieldWarning,
  SignOut as PhSignOut,
  SlidersHorizontal as PhSlidersHorizontal,
  Sparkle as PhSparkle,
  Stack as PhStack,
  Star as PhStar,
  Sun as PhSun,
  Tag as PhTag,
  Target as PhTarget,
  Trash as PhTrash,
  TrendDown as PhTrendDown,
  TrendUp as PhTrendUp,
  UploadSimple as PhUploadSimple,
  User as PhUser,
  Wallet as PhWallet,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  X as PhX,
  Binoculars as PhBinocularsIcon,
  Plant as PhPlantIcon,
  Coins as PhCoinsIcon,
  ChartPieSlice as PhChartPieSliceIcon,
  Waves as PhWavesIcon,
  Trophy as PhTrophyIcon,
  Mountains as PhMountainsIcon,
  ChartBar as PhChartBarIcon,
  Footprints as PhFootprintsIcon,
  Vault as PhVaultIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

export type AppIconProps = Omit<IconProps, "ref"> & {
  /** Aceptado por compatibilidad con Lucide; Phosphor no usa trazo. */
  strokeWidth?: number | string
}
export type AppIcon = ComponentType<AppIconProps>
/** Alias de compatibilidad con el tipo de Lucide. */
export type LucideIcon = AppIcon

export function makeIcon(Base: PhosphorIcon, defaultWeight: IconWeight, name: string): AppIcon {
  const Wrapped = forwardRef<SVGSVGElement, AppIconProps>(function AppIconImpl({ className, weight, strokeWidth, size = 24, ...props }, ref) {
    void strokeWidth // compatibilidad con Lucide: se ignora
    const w = weight ?? defaultWeight
    return <Base ref={ref} weight={w} size={size} aria-hidden={props["aria-label"] ? undefined : true} className={cn("app-icon", w === "duotone" && "app-icon-duo", className)} {...props} />
  })
  Wrapped.displayName = name
  return Wrapped
}

export const Activity = makeIcon(PhPulse, "duotone", "Activity")
export const AlertCircle = makeIcon(PhWarningCircle, "regular", "AlertCircle")
export const AlertTriangle = makeIcon(PhWarning, "regular", "AlertTriangle")
export const ArrowDownCircle = makeIcon(PhArrowCircleDown, "duotone", "ArrowDownCircle")
export const ArrowDownRight = makeIcon(PhArrowDownRight, "bold", "ArrowDownRight")
export const ArrowLeft = makeIcon(PhArrowLeft, "regular", "ArrowLeft")
export const ArrowLeftRight = makeIcon(PhArrowsLeftRight, "regular", "ArrowLeftRight")
/** Traspaso en versión dúo (selector de tipo del diálogo de movimiento). */
export const ArrowsLeftRight = makeIcon(PhArrowsLeftRight, "duotone", "ArrowsLeftRight")
export const ArrowRight = makeIcon(PhArrowRight, "regular", "ArrowRight")
export const ArrowRightLeft = makeIcon(PhArrowsLeftRight, "regular", "ArrowRightLeft")
export const ArrowUpCircle = makeIcon(PhArrowCircleUp, "duotone", "ArrowUpCircle")
export const ArrowUpRight = makeIcon(PhArrowUpRight, "bold", "ArrowUpRight")
export const Bug = makeIcon(PhBug, "duotone", "Bug")
export const Bell = makeIcon(PhBell, "duotone", "Bell")
export const Building2 = makeIcon(PhBuildings, "duotone", "Building2")
export const Calendar = makeIcon(PhCalendar, "regular", "Calendar")
export const CalendarClock = makeIcon(PhCalendarDots, "duotone", "CalendarClock")
export const CalendarDays = makeIcon(PhCalendarDots, "duotone", "CalendarDays")
export const CalendarRange = makeIcon(PhCalendarBlank, "regular", "CalendarRange")
export const ChartLineUp = makeIcon(PhChartLineUp, "duotone", "ChartLineUp")
export const ChatText = makeIcon(PhChatCircleText, "duotone", "ChatText")
export const ChartPie = makeIcon(PhChartLineUp, "duotone", "ChartPie")
export const Check = makeIcon(PhCheck, "bold", "Check")
export const CheckCircle = makeIcon(PhCheckCircle, "duotone", "CheckCircle")
export const CheckIcon = makeIcon(PhCheck, "bold", "CheckIcon")
export const Palette = makeIcon(PhPalette, "duotone", "Palette")
export const ChevronDown = makeIcon(PhCaretDown, "regular", "ChevronDown")
export const ChevronDownIcon = makeIcon(PhCaretDown, "regular", "ChevronDownIcon")
export const ChevronLeft = makeIcon(PhCaretLeft, "regular", "ChevronLeft")
export const ChevronRight = makeIcon(PhCaretRight, "regular", "ChevronRight")
export const ChevronUpIcon = makeIcon(PhCaretUp, "regular", "ChevronUpIcon")
export const ChevronsDownUp = makeIcon(PhArrowsInLineVertical, "regular", "ChevronsDownUp")
export const ChevronsUpDown = makeIcon(PhCaretUpDown, "regular", "ChevronsUpDown")
export const CircleAlert = makeIcon(PhWarningCircle, "regular", "CircleAlert")
export const Clock3 = makeIcon(PhClock, "regular", "Clock3")
export const Cloud = makeIcon(PhCloud, "regular", "Cloud")
export const CloudOff = makeIcon(PhCloudSlash, "regular", "CloudOff")
export const Copy = makeIcon(PhCopy, "regular", "Copy")
export const CreditCard = makeIcon(PhCreditCard, "duotone", "CreditCard")
export const Crown = makeIcon(PhCrown, "duotone", "Crown")
export const Download = makeIcon(PhDownloadSimple, "regular", "Download")
export const Ellipsis = makeIcon(PhDotsThree, "bold", "Ellipsis")
export const Eye = makeIcon(PhEye, "regular", "Eye")
export const EyeOff = makeIcon(PhEyeSlash, "regular", "EyeOff")
export const FileDown = makeIcon(PhFileArrowDown, "regular", "FileDown")
export const Filter = makeIcon(PhFunnel, "regular", "Filter")
export const Flag = makeIcon(PhFlag, "duotone", "Flag")
export const Flame = makeIcon(PhFire, "duotone", "Flame")
export const Gauge = makeIcon(PhGauge, "duotone", "Gauge")
export const HandCoins = makeIcon(PhHandCoins, "duotone", "HandCoins")
export const HardDrive = makeIcon(PhHardDrive, "duotone", "HardDrive")
export const House = makeIcon(PhHouse, "duotone", "House")
export const CarProfile = makeIcon(PhCarProfile, "duotone", "CarProfile")
export const Watch = makeIcon(PhWatch, "duotone", "Watch")
export const ClockCounterClockwise = makeIcon(PhClockCounterClockwise, "duotone", "ClockCounterClockwise")
export const Diamond = makeIcon(PhDiamond, "duotone", "Diamond")
export const PaintBrush = makeIcon(PhPaintBrush, "duotone", "PaintBrush")
export const Package = makeIcon(PhPackage, "duotone", "Package")
export const Scales = makeIcon(PhScales, "duotone", "Scales")
export const Info = makeIcon(PhInfo, "regular", "Info")
export const KeyRound = makeIcon(PhKey, "regular", "KeyRound")
export const Landmark = makeIcon(PhBank, "duotone", "Landmark")
export const Layers = makeIcon(PhStack, "duotone", "Layers")
export const Layers3 = makeIcon(PhStack, "duotone", "Layers3")
export const Lightbulb = makeIcon(PhLightbulb, "duotone", "Lightbulb")
export const LineChart = makeIcon(PhChartLine, "duotone", "LineChart")
export const List = makeIcon(PhList, "regular", "List")
export const Loader2 = makeIcon(PhCircleNotch, "bold", "Loader2")
export const LogOut = makeIcon(PhSignOut, "regular", "LogOut")
export const Lock = makeIcon(PhLockSimple, "duotone", "Lock")
export const Maximize2 = makeIcon(PhArrowsOut, "regular", "Maximize2")
export const Money = makeIcon(PhMoney, "duotone", "Money")
export const Minus = makeIcon(PhMinus, "bold", "Minus")
export const MoonStar = makeIcon(PhMoonStars, "regular", "MoonStar")
export const Pencil = makeIcon(PhPencilSimple, "regular", "Pencil")
export const PencilLine = makeIcon(PhPencilLine, "regular", "PencilLine")
export const Percent = makeIcon(PhPercent, "duotone", "Percent")
export const PiggyBank = makeIcon(PhPiggyBank, "duotone", "PiggyBank")
export const Plus = makeIcon(PhPlus, "bold", "Plus")
export const Receipt = makeIcon(PhReceipt, "duotone", "Receipt")
export const ReceiptText = makeIcon(PhReceipt, "duotone", "ReceiptText")
export const Repeat = makeIcon(PhRepeat, "regular", "Repeat")
export const Repeat2 = makeIcon(PhArrowsClockwise, "regular", "Repeat2")
export const RotateCcw = makeIcon(PhArrowCounterClockwise, "regular", "RotateCcw")
export const Search = makeIcon(PhMagnifyingGlass, "regular", "Search")
export const SearchX = makeIcon(PhMagnifyingGlassMinus, "duotone", "SearchX")
export const Send = makeIcon(PhPaperPlaneTilt, "regular", "Send")
export const ShieldAlert = makeIcon(PhShieldWarning, "duotone", "ShieldAlert")
export const ShieldCheck = makeIcon(PhShieldCheck, "duotone", "ShieldCheck")
export const SlidersHorizontal = makeIcon(PhSlidersHorizontal, "duotone", "SlidersHorizontal")
export const Sparkles = makeIcon(PhSparkle, "duotone", "Sparkles")
export const Smartphone = makeIcon(PhDeviceMobile, "duotone", "Smartphone")
export const Star = makeIcon(PhStar, "duotone", "Star")
export const SunMedium = makeIcon(PhSun, "regular", "SunMedium")
export const Tags = makeIcon(PhTag, "regular", "Tags")
export const Target = makeIcon(PhTarget, "duotone", "Target")
export const Trash2 = makeIcon(PhTrash, "regular", "Trash2")
export const TrendingDown = makeIcon(PhTrendDown, "duotone", "TrendingDown")
export const TrendingUp = makeIcon(PhTrendUp, "duotone", "TrendingUp")
export const Upload = makeIcon(PhUploadSimple, "regular", "Upload")
export const UserRound = makeIcon(PhUser, "duotone", "UserRound")
export const Wallet = makeIcon(PhWallet, "duotone", "Wallet")
export const Wallet2 = makeIcon(PhWallet, "duotone", "Wallet2")
export const X = makeIcon(PhX, "regular", "X")
export const XIcon = makeIcon(PhX, "regular", "XIcon")

export const Binoculars = makeIcon(PhBinocularsIcon, "duotone", "Binoculars")
export const Plant = makeIcon(PhPlantIcon, "duotone", "Plant")
export const Coins = makeIcon(PhCoinsIcon, "duotone", "Coins")
export const ChartPieSlice = makeIcon(PhChartPieSliceIcon, "duotone", "ChartPieSlice")
export const Waves = makeIcon(PhWavesIcon, "duotone", "Waves")
export const Trophy = makeIcon(PhTrophyIcon, "duotone", "Trophy")
export const Mountains = makeIcon(PhMountainsIcon, "duotone", "Mountains")
export const ChartBar = makeIcon(PhChartBarIcon, "duotone", "ChartBar")
export const Footprints = makeIcon(PhFootprintsIcon, "duotone", "Footprints")

export const Vault = makeIcon(PhVaultIcon, "duotone", "Vault")
