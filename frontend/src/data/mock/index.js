export const user = {
  id: "user_001",
  name: "Alex",
  email: "alex@example.com",
  avatarUrl: null,
  subjects: ["os", "dbms"],
  goals: ["exam_preparation"],
  preferences: { learningStyles: ["examples", "short_explanations"], preferredDifficulty: "medium", voiceEnabled: true },
  createdAt: "2026-10-03T10:00:00Z"
};

export const subjects = [
  { id:"os", name:"Operating Systems", icon:"cpu", description:"Operating system fundamentals", totalTopics:6, completedTopics:0 },
  { id:"dbms", name:"Database Management", icon:"database", description:"Database concepts and systems", totalTopics:4, completedTopics:0 },
  { id:"ai", name:"Artificial Intelligence", icon:"brain", description:"Core artificial intelligence concepts", totalTopics:4, completedTopics:0 },
  { id:"web", name:"Web Development", icon:"globe", description:"Modern web development fundamentals", totalTopics:4, completedTopics:0 }
];

export const topics = [
  {id:"processes",subjectId:"os",name:"Process Management",description:"Processes, threads and process states",mastery:0,accuracy:0,attempts:0,status:"not_started",difficulty:"easy"},
  {id:"scheduling",subjectId:"os",name:"CPU Scheduling",description:"Scheduling algorithms",mastery:74,accuracy:78,attempts:15,status:"improving",difficulty:"medium"},
  {id:"synchronization",subjectId:"os",name:"Process Synchronization",description:"Coordination and synchronization of processes",mastery:0,accuracy:0,attempts:0,status:"not_started",difficulty:"easy"},
  {id:"deadlocks",subjectId:"os",name:"Deadlocks",description:"Deadlock conditions, prevention and avoidance",mastery:42,accuracy:45,attempts:12,status:"needs_attention",difficulty:"medium"},
  {id:"memory",subjectId:"os",name:"Memory Management",description:"Memory management",mastery:63,accuracy:66,attempts:11,status:"improving",difficulty:"medium"},
  {id:"filesystems",subjectId:"os",name:"File Systems",description:"Files, directories and storage organization",mastery:0,accuracy:0,attempts:0,status:"not_started",difficulty:"easy"},
  ...[
    ["dbms","Relational Models"],["dbms","SQL Queries"],["dbms","Normalization"],["dbms","Transactions"],["dbms","Indexing"],
    ["ai","Search and Planning"],["ai","Knowledge Representation"],["ai","Machine Learning Basics"],["ai","Neural Networks"],["ai","Evaluation"],
    ["web","HTML and Semantics"],["web","CSS and Layout"],["web","JavaScript"],["web","HTTP and APIs"],["web","Accessibility"]
  ].map(([subjectId,name], index) => ({ id:`${subjectId}_topic_${index % 5}`, subjectId, name, description:`${name} fundamentals`, mastery:0, accuracy:0, attempts:0, status:"not_started", difficulty:"easy" }))
];

export const questions = [
  {id:"q001",topicId:"deadlocks",difficulty:"medium",question:"Which condition is necessary for deadlock?",options:[{id:"a",text:"Paging"},{id:"b",text:"Mutual exclusion"},{id:"c",text:"Scheduling"},{id:"d",text:"Virtual memory"}],correctOptionId:"b",explanation:"Mutual exclusion is one of the four necessary conditions for deadlock.",estimatedTimeSeconds:30},
  {id:"q002",topicId:"deadlocks",difficulty:"medium",question:"Which algorithm is used for deadlock avoidance?",options:[{id:"a",text:"Banker's Algorithm"},{id:"b",text:"Round Robin"},{id:"c",text:"FIFO"},{id:"d",text:"LRU"}],correctOptionId:"a",explanation:"Banker's Algorithm checks whether resource allocation keeps the system in a safe state.",estimatedTimeSeconds:35},
  {id:"q003",topicId:"deadlocks",difficulty:"easy",question:"Which condition means a process holds one resource while waiting for another?",options:[{id:"a",text:"Hold and wait"},{id:"b",text:"Mutual exclusion"},{id:"c",text:"Preemption"},{id:"d",text:"Paging"}],correctOptionId:"a",explanation:"Hold and wait means a process keeps resources while requesting additional resources.",estimatedTimeSeconds:30},
  {id:"q004",topicId:"deadlocks",difficulty:"medium",question:"What does a safe state guarantee?",options:[{id:"a",text:"No process ever waits"},{id:"b",text:"A safe sequence exists"},{id:"c",text:"All processes finish simultaneously"},{id:"d",text:"Resources are never shared"}],correctOptionId:"b",explanation:"A safe state has at least one ordering in which every process can obtain resources and finish.",estimatedTimeSeconds:35},
  {id:"q005",topicId:"processes",difficulty:"easy",question:"Which structure stores information about a process?",options:[{id:"a",text:"PCB"},{id:"b",text:"Page table"},{id:"c",text:"Cache"},{id:"d",text:"Stack frame"}],correctOptionId:"a",explanation:"The Process Control Block stores process management information.",estimatedTimeSeconds:25},
  {id:"q006",topicId:"scheduling",difficulty:"medium",question:"Which scheduling algorithm gives each process a time quantum?",options:[{id:"a",text:"FCFS"},{id:"b",text:"Round Robin"},{id:"c",text:"SJF"},{id:"d",text:"Priority only"}],correctOptionId:"b",explanation:"Round Robin schedules processes using a fixed time quantum.",estimatedTimeSeconds:25},
  {id:"q007",topicId:"memory",difficulty:"medium",question:"What technique allows non-contiguous memory allocation?",options:[{id:"a",text:"Paging"},{id:"b",text:"FCFS"},{id:"c",text:"Deadlock detection"},{id:"d",text:"Round Robin"}],correctOptionId:"a",explanation:"Paging divides memory into fixed-size pages and frames.",estimatedTimeSeconds:25},
  {id:"q008",topicId:"deadlocks",difficulty:"hard",question:"Which condition can be broken by preempting resources?",options:[{id:"a",text:"No preemption"},{id:"b",text:"Mutual exclusion"},{id:"c",text:"Circular wait only"},{id:"d",text:"Hold and wait only"}],correctOptionId:"a",explanation:"Allowing resource preemption breaks the no-preemption condition.",estimatedTimeSeconds:35},
  {id:"q009",topicId:"processes",difficulty:"easy",question:"Which state means a process is currently using the CPU?",options:[{id:"a",text:"Ready"},{id:"b",text:"Running"},{id:"c",text:"Waiting"},{id:"d",text:"New"}],correctOptionId:"b",explanation:"A running process is currently executing on the CPU.",estimatedTimeSeconds:25},
  {id:"q010",topicId:"memory",difficulty:"medium",question:"Which memory is closest to the CPU and typically fastest?",options:[{id:"a",text:"Hard disk"},{id:"b",text:"RAM"},{id:"c",text:"Cache"},{id:"d",text:"SSD"}],correctOptionId:"c",explanation:"CPU cache is a small, high-speed memory close to the processor.",estimatedTimeSeconds:25},
  {id:"q011",topicId:"synchronization",difficulty:"medium",question:"What does a semaphore help coordinate?",options:[{id:"a",text:"Access to shared resources"},{id:"b",text:"File allocation"},{id:"c",text:"CPU instruction decoding"},{id:"d",text:"Page replacement"}],correctOptionId:"a",explanation:"A semaphore coordinates access to shared resources among concurrent processes.",estimatedTimeSeconds:30},
  {id:"q012",topicId:"filesystems",difficulty:"easy",question:"What does a file system organize?",options:[{id:"a",text:"Files and directories on storage"},{id:"b",text:"CPU time slices"},{id:"c",text:"Process states"},{id:"d",text:"Network packets"}],correctOptionId:"a",explanation:"A file system organizes and provides access to files and directories on storage.",estimatedTimeSeconds:25},
  ...[
    ["dbms","What uniquely identifies each row in a relational table?","A primary key","A view","A trigger","A schema",0,"A primary key uniquely identifies a row."],
    ["dbms","Which SQL clause filters rows before grouping?","WHERE","HAVING","ORDER BY","JOIN",0,"WHERE filters rows before grouping."],
    ["dbms","What is the main purpose of normalization?","Reduce unwanted redundancy","Encrypt every column","Speed up every query","Remove all keys",0,"Normalization organizes data to reduce redundancy and update anomalies."],
    ["dbms","What does ACID atomicity mean?","A transaction happens completely or not at all","Transactions always run in alphabetical order","Data is stored only once","Queries never wait",0,"Atomicity means all transaction operations commit together or none do."],
    ["dbms","What can an index help improve?","Lookup speed","Column meaning","Data validity by itself","Transaction isolation",0,"An index can speed up lookups, with storage and write costs."],
    ["ai","Which search method explores the shallowest nodes first?","Breadth-first search","Depth-first search","Random restart","Greedy descent",0,"Breadth-first search visits nodes by increasing depth."],
    ["ai","What does a heuristic estimate in informed search?","Distance or cost to a goal","The number of training labels","The size of a database","Network latency",0,"A heuristic estimates remaining cost toward a goal."],
    ["ai","In supervised learning, training examples include what?","Input and target labels","Only unlabeled inputs","Only model weights","Reward signals only",0,"Supervised examples pair inputs with target labels."],
    ["ai","What is a neural network weight used for?","Scaling connections between units","Naming input files","Sorting training rows","Measuring disk space",0,"Weights determine the strength of connections in a network."],
    ["ai","On unseen data, what does a test set estimate?","Generalization performance","Training speed","Model file size","Label creation cost",0,"A held-out test set estimates performance on unseen examples."],
    ["web","Which HTML element represents the main content of a page?","main","span","meta","title",0,"The main element identifies a page's dominant content."],
    ["web","Which CSS layout system is designed for one-dimensional arrangement?","Flexbox","Grid","Float","Positioning",0,"Flexbox lays out items along a row or column."],
    ["web","Which JavaScript declaration cannot be reassigned?","const","let","var","function",0,"A const binding cannot be reassigned."],
    ["web","Which HTTP method is commonly used to retrieve a resource?","GET","POST","PATCH","DELETE",0,"GET requests representation of a resource."],
    ["web","What does an accessible label help provide?","A programmatic name for a control","A background color","A network cache","A layout breakpoint",0,"Labels expose a control's purpose to assistive technology."]
  ].map(([subjectId,question,a,b,c,d,correct,explanation], index) => ({id:`q_${subjectId}_${index}`,topicId:`${subjectId}_topic_${index % 5}`,difficulty:"easy",question,options:[a,b,c,d].map((text,i)=>({id:String.fromCharCode(97+i),text})),correctOptionId:String.fromCharCode(97+correct),explanation,estimatedTimeSeconds:30}))
];

export const attempts = [];
export const learningProfile = {userId:"user_001",overallScore:67,knowledge:{os:67,dbms:72},topicMastery:topics.map(t=>({topicId:t.id,score:t.mastery})),learningBehavior:{conceptUnderstanding:78,application:51,recall:69,problemSolving:47},learningStyles:["examples","short_explanations"],adaptiveLevel:"medium",updatedAt:"2026-10-03T10:20:00Z"};
export const mistakes = [{id:"mistake_001",userId:"user_001",topicId:"deadlocks",concept:"bankers_algorithm",count:3,lastAttemptCorrect:false,severity:"high"}];
export const recommendations = [{id:"rec_001",userId:"user_001",type:"topic_practice",topicId:"deadlocks",title:"Practice Banker's Algorithm",reason:"Your recent accuracy in this concept is low.",durationMinutes:15,priority:"high",createdAt:"2026-10-03T10:20:00Z"}];
export const dashboard = {user:{name:"Alex"},learningHealth:{score:67,weeklyChange:12},momentum:{streakDays:6,questionsAnswered:124,weeklyAccuracy:78,weeklyImprovement:18},weakTopics:[{topicId:"deadlocks",name:"Deadlocks",score:42}],recommendation:{topicId:"deadlocks",title:"Practice Banker's Algorithm",durationMinutes:15},aiInsight:"You learn application concepts better after seeing a real-world example."};
export const studyPlan = {id:"plan_001",userId:"user_001",date:"2026-10-03",totalMinutes:20,items:[{id:"plan_item_1",title:"Review Deadlock Conditions",topicId:"deadlocks",durationMinutes:5,type:"review",status:"pending"},{id:"plan_item_2",title:"Learn Banker's Algorithm",topicId:"deadlocks",durationMinutes:8,type:"lesson",status:"pending"},{id:"plan_item_3",title:"Practice 3 Questions",topicId:"deadlocks",durationMinutes:5,type:"practice",status:"pending"},{id:"plan_item_4",title:"Quick Recall",topicId:"deadlocks",durationMinutes:2,type:"recall",status:"pending"}]};
export const aiInsights = [{id:"insight_001",type:"learning_behavior",title:"ADAPT noticed something",message:"Your accuracy is high on conceptual questions but drops on application-based problems.",severity:"info",relatedTopicId:"deadlocks"}];
export const tutorMessages = [{id:"msg_001",role:"assistant",content:"Let's understand deadlock using a simple real-world example.",messageType:"explanation",topicId:"deadlocks",difficulty:"beginner",timestamp:"2026-10-03T10:30:00Z"}];
export const voiceSession = {id:"voice_001",userId:"user_001",status:"idle",mode:"tutor",transcript:[],topicId:"deadlocks"};
export const voiceQuizResult = {questionId:"q_voice_001",transcript:"Mutual exclusion and hold and wait",score:2,total:4,identifiedConcepts:["mutual_exclusion","hold_and_wait"],missingConcepts:["circular_wait","no_preemption"],feedback:"You understand mutual exclusion and hold-and-wait. Let's work on circular wait and no preemption."};
export const progress = {overall:{current:67,previous:49,change:18},topicProgress:[{topicId:"deadlocks",name:"Deadlocks",previous:42,current:68,change:26}],statistics:{questionsCompleted:124,learningMinutes:320,streakDays:6,accuracy:78}};
export const offlineStatus = {status:"online",lastSyncedAt:"2026-10-03T10:42:00Z",pendingSyncCount:0,availableOffline:{profile:true,lessons:true,questions:true,progress:true,recommendations:true}};
