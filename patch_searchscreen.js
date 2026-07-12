import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const SearchScreen = \(\) => \{\n  const \[searchParams\] = useSearchParams\(\);\n  const \[queryText, setQueryText\] = useState\(searchParams\.get\('q'\) \|\| ''\);\n  const \[users, setUsers\] = useState<User\[\]>\(\[\]\);\n  const \{ currentUser, posts \} = useApp\(\);/;

const newCode = `const SearchScreen = () => {
  const [searchParams] = useSearchParams();
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [users, setUsers] = useState<User[]>([]);
  const { currentUser, posts } = useApp();

  useEffect(() => {
    setQueryText(searchParams.get('q') || '');
  }, [searchParams]);`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/App.tsx', code);
