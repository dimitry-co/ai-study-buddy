interface HeaderProps {
    onSignOut: () => void; // Function to handle signout, called by parent (page.tsx). it's passed as a prop to the component so it can be used in the component.
}

const Header = (props: HeaderProps) => {
    return (
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white">AI Study Buddy</h1>
            <button
              onClick={props.onSignOut}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-3xl font-semibold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
    );
};

export default Header;