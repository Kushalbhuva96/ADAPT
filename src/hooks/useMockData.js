import { useEffect, useState } from "react";
export function useMockData(loader, initial=null){
  const [data,setData]=useState(initial); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  useEffect(()=>{let active=true; setLoading(true); loader().then(v=>active&&setData(v)).catch(e=>active&&setError(e)).finally(()=>active&&setLoading(false)); return ()=>{active=false};},[loader]);
  return {data,loading,error,setData};
}
