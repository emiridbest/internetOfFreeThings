"use client";
import { useState, useEffect, useRef, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAccount, useDisconnect } from "wagmi";
import { 
  useDynamicContext, 
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import { 
  MagnifyingGlassIcon, 
  BellAlertIcon,
  ChevronDownIcon,
  Bars3Icon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  WalletIcon
} from "@heroicons/react/24/outline";
import { ThemeContext } from "@/components/ThemeProvider";
import { cn } from "../lib/utils";
import { 
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Header() {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { setShowAuthFlow, user, handleLogOut } = useDynamicContext();

  // Handle wallet connection
  const handleConnect = () => {
    setShowAuthFlow(true);
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await handleLogOut();
      disconnect();
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get user info
  const getUserInfo = () => {
    if (user) {
      return {
        name: user.alias || user.email || 'User',
        email: user.email || ''
      };
    }
    return null;
  };

  const userInfo = getUserInfo();

  const handleSearchIconClick = () => {
    setSearchVisible(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue('');
      setSearchVisible(false);
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Navigation links
  const navLinks = [
    { title: "Freebies", href: "/freebies" },
  ];



  // User menu items
  const userMenuItems = [
    { title: "Profile", href: "/profile", icon: UserCircleIcon },
    { title: "Settings", href: "/settings", icon: WalletIcon },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-black/80 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Image
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              src="/vercel.svg"
              priority
              width="20"
              height="20"
              alt="VercelLogo"
              onClick={() => router.push('/')}
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <NavigationMenu>
              <NavigationMenuList>
                {navLinks.map((link) => (
                  <NavigationMenuItem key={link.title}>
                    <NavigationMenuLink asChild>
                      <Link 
                        href={link.href}
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "dark:text-primary hover:bg-primary/10 hover:text-primary transition-all duration-300",
                          pathname === link.href && "text-primary border-b-2 border-primary"
                        )}
                      >
                        {link.title}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}

                <NavigationMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        className="h-9 gap-1 hover:bg-primary/10 text-black dark:text-primary hover:text-primary"
                      >
                        About Us
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="w-56 glass-card" 
                      align="end" 
                      sideOffset={8}
                    >
                      <DropdownMenuGroup>

                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              {searchVisible ? (
                <form onSubmit={handleSearchSubmit} className="flex items-center glass-card rounded-full pr-2">
                  <Input
                    className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-w-[200px]"
                    type="search"
                    placeholder="Search..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onBlur={() => {
                      if (!searchValue) setSearchVisible(false);
                    }}
                    autoFocus
                  />
                  <Button 
                    type="submit"
                    className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-transparent"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <Button 
                  onClick={handleSearchIconClick}
                  className="hover:bg-primary/10 text-black/80 dark:text-primary hover:text-primary"
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Notifications */}
            <Button 

              className="hover:bg-primary/10 hover:text-primary relative text-black/80 dark:text-primary"
            >
              <BellAlertIcon className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
            </Button>

            {/* Connect/User Menu */}
            {isConnected && userInfo ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-10 gap-2 hover:bg-primary/10 px-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {userInfo.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium text-black dark:text-primary">
                        {userInfo.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatAddress(address || '')}
                      </span>
                    </div>
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 glass-card" align="end" sideOffset={8}>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{userInfo.name}</p>
                    <p className="text-xs text-gray-500">{userInfo.email}</p>
                    <p className="text-xs text-gray-500">{formatAddress(address || '')}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {userMenuItems.map((item) => (
                      <DropdownMenuItem key={item.title} asChild>
                        <Link href={item.href} className="cursor-pointer">
                          <item.icon className="h-4 w-4 mr-2" />
                          {item.title}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleDisconnect}
                    className="cursor-pointer text-red-600 hover:text-red-700 focus:text-red-700"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={handleConnect}
                className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2 rounded-lg transition-all duration-300 hover:scale-105"
              >
                <WalletIcon className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            )}

            {/* Mobile menu */}
            <div className="md:hidden">
              <Sheet >
                <SheetTrigger asChild>
                  <Button className="text-black/80 dark:text-primary hover:bg-primary/10">
                    <Bars3Icon className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="glass-card w-[80%]">
                  <div className="flex flex-col space-y-4 mt-8">
                    {/* Mobile Connect Button */}
                    {!isConnected ? (
                      <Button 
                        onClick={handleConnect}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-lg"
                      >
                        <WalletIcon className="h-4 w-4 mr-2" />
                        Connect Wallet
                      </Button>
                    ) : (
                      <div className="bg-primary/10 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {userInfo?.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-primary">{userInfo?.name}</p>
                            <p className="text-xs text-gray-500">{formatAddress(address || '')}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={handleDisconnect}
                          className="w-full mt-2 text-red-600 hover:text-red-700"
                        >
                          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    )}

                    <div className="dark:text-gray-500">
                      <Link 
                        href="/" 
                        className={cn(
                          "py-2 px-4 rounded-lg transition-all duration-300 block",
                          pathname === "/" 
                            ? "bg-primary/10 text-primary border-l-2 border-primary" 
                            : "hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        Home
                      </Link>
                      
                      {navLinks.map((link) => (
                        <Link 
                          key={link.title}
                          href={link.href} 
                          className={cn(
                            "py-2 px-4 rounded-lg transition-all duration-300 block",
                            pathname === link.href 
                              ? "bg-primary/10 text-primary border-l-2 border-primary" 
                              : "hover:bg-primary/10 hover:text-primary"
                          )}
                        >
                          {link.title}
                        </Link>
                      ))}
                      

                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
