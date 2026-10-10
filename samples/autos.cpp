auto globalValue = 1;
const auto bufferSize = 4;
auto& globalRef = globalValue;
const auto* globalPtr = &globalValue;
constexpr auto enabled = true;

auto add(int a, int b) {
	return a + b;
}

auto trailing(int a) -> int {
	return a;
}

auto& getGlobalRef() {
	return globalRef;
}

decltype(auto) identity(int& value) {
	return (value);
}

class Widget {
	auto current();

	auto scaled(int n) -> int {
		return n;
	}
};

auto Widget::current() {
	return 1;
}