import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>, isLogin: boolean) => {
    event.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(event.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    
    try {
      const result = await (isLogin ? login : register)({ username, password });
      if (!result.ok) {
        throw new Error(result.message);
      }
      
      toast({
        title: isLogin ? "Login successful" : "Registration successful",
        description: `Welcome ${username}!`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container flex items-center justify-center min-h-screen">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Railway Operations</CardTitle>
          <CardDescription>Login or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    name="username"
                    placeholder="Username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Login
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    name="username"
                    placeholder="Username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Register
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
