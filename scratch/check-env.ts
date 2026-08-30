console.log("Environment Keys:", Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("SERVICE") || k.includes("ROLE") || k.includes("KEY") || k.includes("SECRET")));
